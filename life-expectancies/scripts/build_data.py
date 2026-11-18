"""Rebuild the atlas data from CDC and Census public downloads.

Install numpy and pyshp, then run python3 scripts/build_data.py <cache-dir>.
The cache directory holds public source files and may be reused.
"""
import argparse
import csv
import io
import json
import subprocess
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import shapefile

ROOT = Path(__file__).resolve().parents[1]
CENSUS = "https://www2.census.gov"
GAZ = CENSUS + "/geo/docs/maps-data/data/gazetteer"
SHAPES = CENSUS + "/geo/tiger/GENZ2015/shp"
ACS = CENSUS + "/programs-surveys/acs/summary_file/2015/data/5_year_seq_by_state"
CDC = "https://data.cdc.gov/api/views/5h56-n989/rows.csv?accessType=DOWNLOAD"
RACE = ["White", "Black", "American Indian or Alaska Native", "Asian",
        "Native Hawaiian or Pacific Islander", "Some other race", "Two or more races",
        "Hispanic or Latino"]
RECODE = {"02270": "02158", "46113": "46102", "51515": "51019"}
MIN_COVERAGE = 0.80
TERRITORIES = {"60", "66", "69", "72", "78"}


def download(url, path):
    if not path.is_file():
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".part")
        subprocess.run(["curl", "-fsSL", "--retry", "2", "--max-time", "45",
                        url, "-o", str(tmp)], check=True)
        tmp.replace(path)
    return path


def gazetteer(cache, kind):
    path = download(f"{GAZ}/Gaz_{kind}_national.zip", cache / f"gaz-{kind}.zip")
    with ZipFile(path) as archive:
        with archive.open(archive.namelist()[0]) as stream:
            return list(csv.DictReader(io.TextIOWrapper(stream, encoding="latin-1"), delimiter="\t"))


def features(cache, kind):
    path = download(f"{SHAPES}/cb_2015_us_{kind}_5m.zip", cache / f"{kind}2015.zip")
    result = []
    with ZipFile(path) as archive:
        def member(ext):
            return io.BytesIO(archive.read(f"cb_2015_us_{kind}_5m.{ext}"))
        reader = shapefile.Reader(shp=member("shp"), dbf=member("dbf"), shx=member("shx"))
        for item in reader.iterShapeRecords():
            record = item.record.as_dict()
            if record["STATEFP"] in TERRITORIES:
                continue
            if kind == "state":
                properties = {"name": record["NAME"], "abbr": record["STUSPS"]}
            else:
                properties = {}
            result.append({"type": "Feature", "id": record["GEOID"], "properties": properties,
                           "geometry": item.shape.__geo_interface__})
    return result


def norm(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text.casefold()) if c.isalnum())


def acs_data(cache, state):
    abbr = state["abbr"].lower()
    name = "DistrictOfColumbia" if abbr == "dc" else state["name"].replace(" ", "")
    base = f"{ACS}/{name}/All_Geographies_Not_Tracts_Block_Groups"
    folder = cache / "acs" / abbr
    geo = download(f"{base}/g20155{abbr}.csv", folder / "geo.csv")
    counties = {}
    with geo.open(encoding="latin-1", newline="") as stream:
        for row in csv.reader(stream):
            if row[2:4] == ["050", "00"]:
                counties[row[4]] = (row[9] + row[10], row[49].rsplit(", ", 1)[0])
    rows = {fips: {"name": name, "state": abbr.upper()} for fips, name in counties.values()}
    for sequence in ("0005", "0059"):
        stem = f"20155{abbr}{sequence}000"
        with ZipFile(download(f"{base}/{stem}.zip", folder / f"{sequence}.zip")) as archive:
            with archive.open(f"e{stem}.txt") as stream:
                for row in csv.reader(io.TextIOWrapper(stream, encoding="ascii")):
                    if row[5] not in counties:
                        continue
                    fips, name = counties[row[5]]
                    record = rows[fips]
                    if sequence == "0059":
                        record["income"] = int(row[176]) if row[176].isdigit() else None
                    else:
                        pop = int(row[37])
                        record["population"] = pop
                        record["race"] = [int(row[37 + i]) / pop for i in (2, 3, 4, 5, 6, 7, 8, 11)] if pop else None
    return rows


def cdc_rollup(cache, states):
    county_names = {(r["USPS"], norm(r["NAME"])): r["GEOID"] for r in gazetteer(cache, "counties")}
    county_names.update({
        ("AK", norm("Kusilvak Census Area")): "02270",
        ("SD", norm("Oglala Lakota County")): "46113",
    })
    tract_pop = {r["GEOID"]: int(r["POP10"]) for r in gazetteer(cache, "tracts")}
    total = defaultdict(int)
    for tract, pop in tract_pop.items():
        old = tract[:5]
        total[RECODE.get(old, old)] += pop

    state_abbr = {f["properties"]["name"]: f["properties"]["abbr"] for f in states}
    covered, years = defaultdict(int), defaultdict(float)
    used, unmatched = {}, []
    with download(CDC, cache / "life.csv").open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            tract, life = row["Census Tract Number"], row["Life Expectancy"]
            if not (tract and life):
                continue
            abbr = state_abbr[row["State"]]
            old = county_names.get((abbr, norm(row["County"].removesuffix(", " + abbr))))
            tract_id = (old or "") + tract.replace(".", "").zfill(6)
            if tract_id not in tract_pop:
                unmatched.append((abbr, row["County"], tract))
                continue
            if tract_id in used:
                if used[tract_id] != float(life):
                    raise ValueError(f"Conflicting CDC estimates for {tract_id}")
                continue
            used[tract_id] = float(life)
            fips = RECODE.get(old, old)
            covered[fips] += tract_pop[tract_id]
            years[fips] += tract_pop[tract_id] * float(life)

    print(f"CDC: {len(used):,} matched tracts and {len(unmatched):,} unmatched rows")
    if not 66500 <= len(used) <= 67148 or len(unmatched) > 500:
        raise ValueError(f"Unexpected CDC geographic coverage: {unmatched[:10]}")
    return {fips: (years[fips] / covered[fips] if covered[fips] else None,
                   covered[fips] / pop if pop else None) for fips, pop in total.items()}


def adjustment(rows):
    sample = [r for r in rows.values() if r["observed"] is not None and r.get("income") and r.get("race")]
    if len(sample) < 2500:
        raise ValueError(f"Only {len(sample)} counties meet the model criteria")
    assert all(abs(sum(r["race"]) - 1) < 1e-8 for r in sample)
    # Race shares total one, so omit White as the reference. A log income
    # predictor makes proportional income changes comparable.
    features = np.array([[np.log(r["income"]), *r["race"][1:]] for r in sample])
    y = np.array([r["observed"] for r in sample])
    design = np.column_stack([np.ones(len(y)), features])
    coef, _, rank, _ = np.linalg.lstsq(design, y, rcond=None)
    if rank != design.shape[1]:
        raise ValueError("Model predictors do not have full rank")
    fitted = design @ coef
    baseline = float(y.mean())
    for row, predicted in zip(sample, fitted):
        row["adjusted"] = row["observed"] - float(predicted) + baseline
        row["predicted"] = float(predicted)
    assert abs(np.mean([r["adjusted"] for r in sample]) - baseline) < 1e-9
    return {"n": len(y), "baseline": baseline, "r2": float(1 - np.sum((y - fitted) ** 2) /
                                                            np.sum((y - baseline) ** 2)),
            "intercept": float(coef[0]), "logIncome": float(coef[1]), "raceCoefficients": coef[2:].tolist(),
            "minCoverage": MIN_COVERAGE, "raceLabels": RACE}


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("cache", type=Path, help="Directory for cached government downloads")
    cache = parser.parse_args().cache
    cache.mkdir(parents=True, exist_ok=True)
    states = features(cache, "state")
    counties = features(cache, "county")
    with ThreadPoolExecutor(max_workers=10) as pool:
        responses = pool.map(lambda state: acs_data(cache, state["properties"]), states)
        demographic = {fips: row for response in responses for fips, row in response.items()}
    rollup = cdc_rollup(cache, states)
    rows = {}
    for county in counties:
        fips = county["id"]
        row = demographic.get(fips)
        if row is None:
            raise ValueError(f"Missing ACS geography {fips}")
        life, coverage = rollup.get(fips, (None, None))
        row.update(observed=life if coverage is not None and coverage >= MIN_COVERAGE else None,
                   coverage=coverage, adjusted=None)
        rows[fips] = row
    model = adjustment(rows)
    print(f"Model: {model['n']:,} of {len(rows):,} counties, R² {model['r2']:.3f}")
    write(ROOT / "data" / "county-data.json", {"model": model, "counties": rows})
    write(ROOT / "data" / "counties.json", {"type": "FeatureCollection", "features": counties})
    write(ROOT / "data" / "states.json", {"type": "FeatureCollection", "features": states})


if __name__ == "__main__":
    main()

"""Build UK local-authority comparisons using the atlas's existing US model.

Requires pandas, openpyxl, xlrd. Source downloads are kept outside the repository;
see the source URLs below and pass the cache directory containing the downloaded files.
"""
import argparse
import io
import json
import urllib.request
import zipfile
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EW_URL = "https://www.nomisweb.co.uk/api/v01/dataset/NM_608_1.data.csv?geography=TYPE464&rural_urban=0"
SCOT_URL = "https://www.scotlandscensus.gov.uk/media/hjmd0oqr/council-area-blk.zip"
NI_URL = "https://www.nisra.gov.uk/system/files/statistics/census-2011-ks201ni.xlsx"
GDHI_URL = "https://www.ons.gov.uk/file?uri=%2Feconomy%2Fregionalaccounts%2Fgrossdisposablehouseholdincome%2Fdatasets%2Fregionalgrossdisposablehouseholdincomegdhibylocalauthorityintheuk%2F1997to2016%2Fvcregionalgdhibylareordered.xlsx"
LE_URL = "https://static.ons.gov.uk/datasets/life-expectancy-by-local-authority-time-series-v1.csv"
# Mean of the inverse World Bank annual GBP-per-USD rates for 2011–2013.
GBP_TO_USD = 1.5817310551188895
PREDECESSORS = {
    "E06000058": ["E06000028", "E06000029", "E07000048"],
    "E06000059": ["E07000049", "E07000050", "E07000051", "E07000052", "E07000053"],
    "E06000060": ["E07000004", "E07000005", "E07000006", "E07000007"],
    "E07000244": ["E07000205", "E07000206"],
    "E07000245": ["E07000201", "E07000204"],
    "E07000246": ["E07000190", "E07000191"],
    "S12000047": ["S12000015"],
    "S12000048": ["S12000024"],
    "S12000049": ["S12000046"],
    "S12000050": ["S12000029"],
}


def fetch(cache, filename, url, referer=None):
    path = cache / filename
    if path.exists():
        return path
    cache.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": "Mozilla/5.0 (compatible; LifeExpectancyAtlas/1.0)"}
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=120) as response:
        path.write_bytes(response.read())
    return path


def ethnicity_rows(cache):
    result = {}
    ew = pd.read_csv(cache / "ew-lad.csv", dtype={"GEOGRAPHY_CODE": str})
    ew = ew[(ew.DATE == 2011) & (ew.RURAL_URBAN_NAME == "Total")]
    for code, rows in ew.groupby("GEOGRAPHY_CODE"):
        def count(label):
            matches = rows.loc[rows.CELL_NAME == label, "OBS_VALUE"]
            return float(matches.iloc[0]) if len(matches) else 0.0
        total = count("All usual residents")
        if total:
            result[code] = {"name": str(rows.GEOGRAPHY_NAME.iloc[0]), "country": "England" if code.startswith("E") else "Wales",
                            "population": total, "white": count("White"), "mixed": count("Mixed/multiple ethnic groups"),
                            "asian": count("Asian/Asian British"), "black": count("Black/African/Caribbean/Black British"),
                            "other": count("Other ethnic group")}

    with zipfile.ZipFile(cache / "scot.zip") as archive:
        scot = pd.read_csv(io.BytesIO(archive.read("KS201SC.csv")), thousands=",")
    for _, row in scot.iterrows():
        code = str(row.iloc[0])
        if not code.startswith("S1"):
            continue
        result[code] = {"name": "", "country": "Scotland", "population": float(row["All people"]),
                        "white": float(row["White"]), "mixed": float(row["Mixed or multiple ethnic groups"]),
                        "asian": float(row["Asian, Asian Scottish or Asian British"]),
                        "black": float(row["African"]) + float(row["Caribbean or Black"]),
                        "other": float(row["Other ethnic groups"])}

    ni = pd.read_excel(cache / "ni.xlsx", sheet_name="LGD2014", header=4)
    ni = ni[ni["LGD2014 Code"].astype(str).str.startswith("N")]
    for _, row in ni.iterrows():
        code = str(row["LGD2014 Code"])
        result[code] = {"name": str(row["LGD2014"]), "country": "Northern Ireland",
                        "population": float(row["All usual residents"]),
                        "white": float(row["Ethnic group: White"]), "mixed": float(row["Ethnic group: Mixed"]),
                        "asian": sum(float(row[c]) for c in ["Ethnic group: Chinese", "Ethnic group: Indian", "Ethnic group: Pakistani", "Ethnic group: Bangladeshi", "Ethnic group: Other Asian"]),
                        "black": sum(float(row[c]) for c in ["Ethnic group: Black Caribbean", "Ethnic group: Black African", "Ethnic group: Black other"]),
                        "other": float(row["Ethnic group: Other"])}
    return result


def incomes(cache):
    frame = pd.read_excel(cache / "gdhi.xlsx", sheet_name="GDHI per head", header=None)
    headers = frame.iloc[2].tolist()
    columns = {int(value): i for i, value in enumerate(headers) if isinstance(value, (int, float)) and int(value) in (2011, 2012, 2013)}
    out = {}
    for _, row in frame.iloc[3:].iterrows():
        code = row.iloc[1]
        if not isinstance(code, str) or code[:1] not in "EWSN":
            continue
        values = [pd.to_numeric(row.iloc[i], errors="coerce") for i in columns.values()]
        values = [float(x) for x in values if pd.notna(x)]
        if values:
            out[code] = sum(values) / len(values) * GBP_TO_USD
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("cache_dir", type=Path, nargs="?", default=Path("/tmp/life-expectancies-uk-source"),
                        help="source cache directory (downloaded automatically when files are missing)")
    args = parser.parse_args()
    cache = args.cache_dir
    fetch(cache, "le.csv", LE_URL)
    fetch(cache, "ew-lad.csv", EW_URL)
    fetch(cache, "scot.zip", SCOT_URL, "https://www.scotlandscensus.gov.uk/")
    fetch(cache, "ni.xlsx", NI_URL)
    fetch(cache, "gdhi.xlsx", GDHI_URL)
    areas = ethnicity_rows(cache)
    income = incomes(cache)
    for target, sources in PREDECESSORS.items():
        members = [areas[code] for code in sources if code in areas]
        income_members = [(areas[code]["population"], income[code]) for code in sources if code in areas and code in income]
        if len(members) != len(sources) or len(income_members) != len(sources):
            continue
        summed = {key: sum(member[key] for member in members) for key in ("population", "white", "mixed", "asian", "black", "other")}
        area_info = {"name": "", "country": "Scotland" if target.startswith("S") else "England", **summed}
        areas[target] = area_info
        income[target] = sum(pop * value for pop, value in income_members) / sum(pop for pop, _ in income_members)
    le = pd.read_csv(cache / "le.csv", usecols=["Time", "AgeGroups", "sex", "administrative-geography", "Geography", "v4_2"])
    le = le[(le.Time == "2011-13") & (le.AgeGroups == "00-01") & le.sex.isin(["male", "female"])]
    life = {}
    for code, rows in le.groupby("administrative-geography"):
        vals = pd.to_numeric(rows.v4_2, errors="coerce").dropna().tolist()
        if len(vals) == 2:
            life[str(code)] = {"name": str(rows.Geography.iloc[0]), "observed": sum(vals) / 2}

    model = json.loads((ROOT / "data/county-data.json").read_text())["model"]
    output = {}
    omitted = {"no life expectancy": 0, "no income": 0, "no census match": 0}
    for code, stat in life.items():
        if code not in areas:
            omitted["no census match"] += 1
            continue
        if code not in income or income[code] <= 0:
            omitted["no income"] += 1
            continue
        census = areas[code]
        total = census["population"]
        if total <= 0:
            continue
        shares = {name: census[name] / total for name in ("white", "mixed", "asian", "black", "other")}
        # UK Census broad groups mapped to the nearest available US regression categories.
        nonwhite = [shares["black"], 0.0, shares["asian"], 0.0, shares["other"], shares["mixed"], 0.0]
        predicted = model["intercept"] + model["logIncome"] * __import__("math").log(income[code])
        predicted += sum(coef * share for coef, share in zip(model["raceCoefficients"], nonwhite))
        adjusted = life[code]["observed"] - predicted + model["baseline"]
        output[code] = {"name": census["name"] or life[code]["name"], "country": census["country"],
                        "population": int(round(total)), "income": round(income[code]),
                        "observed": round(life[code]["observed"], 3), "predicted": round(predicted, 3),
                        "adjusted": round(adjusted, 3), "difference": round(adjusted - model["baseline"], 3),
                        "ethnicity": {key: round(shares[key], 5) for key in shares}}

    if not output:
        raise SystemExit("No UK areas matched; check source geography codes and cached files")
    weighted = lambda field: sum(row[field] * row["population"] for row in output.values()) / sum(row["population"] for row in output.values())
    summary = {"n": len(output), "usBaseline": model["baseline"], "meanObserved": sum(r["observed"] for r in output.values()) / len(output),
               "meanAdjusted": sum(r["adjusted"] for r in output.values()) / len(output),
               "meanDifference": sum(r["difference"] for r in output.values()) / len(output),
               "populationWeightedObserved": weighted("observed"), "populationWeightedAdjusted": weighted("adjusted"),
               "populationWeightedDifference": weighted("difference"), "omitted": omitted,
               "period": "2011–2013", "incomeCurrencyConversion": GBP_TO_USD}
    target = ROOT / "data/uk-area-data.json"
    target.write_text(json.dumps({"summary": summary, "areas": output}, separators=(",", ":")) + "\n")
    print(json.dumps(summary, indent=2))
    print("Wrote", target)


if __name__ == "__main__":
    main()

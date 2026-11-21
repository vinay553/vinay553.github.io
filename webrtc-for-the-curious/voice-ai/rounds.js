const sources = {
  traces: ["Voice turn traces and latency stages · LiveKit", "https://docs.livekit.io/reference/agents/session-traces/"],
  turns: ["Endpointing and interruptions · LiveKit", "https://docs.livekit.io/agents/logic/turns/tuning/"],
  asr: ["Interim and final transcripts · Deepgram", "https://developers.deepgram.com/docs/understand-endpointing-interim-results"],
  opus: ["RTP payload format for Opus · IETF", "https://www.rfc-editor.org/info/rfc7587/"],
  stats: ["WebRTC statistics · W3C", "https://www.w3.org/TR/webrtc-stats/"],
  batch: ["Dynamic and sequence batching · NVIDIA Triton", "https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html"],
  bench: ["Streaming ASR measurements on H100 · NVIDIA", "https://docs.nvidia.com/nim/speech/26.10.0/reference/performances/asr/performance.html"],
  paged: ["PagedAttention and KV memory management · Kwon et al.", "https://arxiv.org/abs/2309.06180"],
  speech: ["Moshi, a real-time speech dialogue model · Défossez et al.", "https://kyutai.org/Moshi.pdf"],
  role: ["Inference engineering role · Cartesia", "https://jobs.ashbyhq.com/cartesia/bd9d6688-5486-470f-a273-20874a44f107"]
};
const rounds = [
  {
    id: "latency", short: "First audible response", title: "Why is the first word late?", minutes: 15, area: "Latency diagnosis",
    lead: "A caller finishes speaking. The dashboard reports a fast first token, yet the caller waits. Draw the critical path from their last sound to the first audible reply.",
    prompt: "The target is 650 ms. Speech recognition and endpoint detection overlap after the last input packet arrives. Predict when the caller hears the reply, then decide whether starting the LLM early buys enough time. What happens if the transcript changes?",
    lab: "Reconstruct one turn", model: "Aligned event clocks · milliseconds",
    probes: [
      ["What counts as the first response?", "A network byte can contain metadata, encoded silence or an incomplete frame. Instrument the first non-silent sample played at the client. Use a loopback recording to calibrate your estimate of device playout."],
      ["Why can a dashboard estimate disagree with a caller?", "ASR and endpoint detection overlap; summing these spans charges for some time twice. Use turn IDs and causal events. Estimating fleet p95 means computing each turn’s end-to-end duration and then taking its percentile. Summing stage p95s loses correlations."],
      ["Where does speculation go wrong?", "An interim hypothesis can revise a name, number or negation. Cancel obsolete work, gate audible output on a committed turn, and defer irreversible tool actions. Compare saved audible latency with extra compute, semantic errors and false cutoffs."]
    ],
    rubric: ["Calculated both dependency joins and stated the clock assumption.", "Separated first token, first synthesizable phrase, first audio and client playout.", "Proposed a falsifiable change with a quality and cost guardrail."],
    answer: "Baseline: the last packet arrives at 45 ms. ASR is ready at 170 and the endpoint decision at 290. Starting the LLM at 290 gives a token at 475, a speakable phrase at 535, PCM at 640 and audible speech at 710 ms. That misses 650 by 60. With a stable hypothesis, start at 170 and gate TTS on the later of the endpoint and phrase. The reply plays at 590 ms. A revision at commit sends this model back to 710 and wastes the speculative prefix. Measure revision rates before predicting the fleet gain.",
    bridge: "Recall a call-quality metric you owned. Which user-visible delay could it miss, and what observation would have exposed it?",
    refs: ["traces","turns"], book: ["debugging","Debugging"]
  },
  {
    id: "interruptions", short: "Turn-taking & cancellation", title: "Can the caller actually interrupt?", minutes: 20, area: "Duplex audio",
    lead: "Your agent says an address. The caller says “wait”, but an old audio chunk is already in flight. Decide who owns the turn and how to avoid replaying stale speech.",
    prompt: "Design a per-call state machine for listening, thinking and speaking. Explain which component can stop sound fastest, which work can still finish after cancellation, and what conversation history should contain afterward.",
    lab: "Replay a barge-in race", model: "One confirmed interruption · synthetic events",
    probes: [
      ["Is the microphone hearing the user?", "Speakerphone echo, double-talk and a backchannel such as “mm-hmm” can all trigger an energy detector. Use the far-end render reference and acoustic echo cancellation; evaluate noisy double-talk and users who genuinely interrupt. Keep provisional detection distinct from confirming a new turn."],
      ["Is a final ASR segment an end of turn?", "A recognizer can finalize several segments within one utterance. Apply revised partials as replacements; concatenate committed segments once. Endpointing trades willingness to wait through a pause against response delay. Evaluate false endpoints, missed interrupts and time until actual silence by audio condition."],
      ["What survives an interrupt or reconnect?", "Use a turn or generation ID, cancel model and TTS jobs, flush the app-controlled queue and reject late chunks at its boundary. Packets already emitted into an RTP/device buffer may remain audible. Use a local playout gate where available and reconcile history to the played prefix. Deduplicate tool actions with stable IDs."]
    ],
    rubric: ["Showed the late-chunk race after cancellation and a generation fence.", "Bound the residual audible tail and distinguished generated, sent and played speech.", "Covered echo, backchannels, history correction and a measurable failure rate."],
    answer: "On confirmed user speech, advance the generation, stop local output as close to playout as the platform allows, clear queued old audio and cancel upstream work. A callback can still arrive. Check its generation again before enqueue. Preserve a playback cursor or acknowledgment so the next model context includes only speech the user could have heard. Keep finalized tool side effects separately; interrupting speech cannot undo a completed booking. On a false interruption, resume from a known position or regenerate a short clarification.",
    bridge: "Pick a genuine double-talk, echo or device-route incident you can discuss. What evidence distinguished a transport fault from an acoustic one?",
    refs: ["turns","asr"], book: ["media","Media communication"]
  },
  {
    id: "audio", short: "Audio ingress & ASR", title: "The packets arrived. Why is the word wrong?", minutes: 20, area: "Media engineering",
    lead: "A gateway receives Opus over WebRTC and feeds a 16 kHz speech recognizer. A missing syllable could originate in capture, the network, resampling or model context.",
    prompt: "Design the audio bridge for 20 ms Opus packets. Explain which clock advances on the wire, what PCM shape the model consumes, how you preserve continuity through loss, and how added context affects partial-transcript stability.",
    lab: "Budget a streaming ASR chunk", model: "Mono signed 16-bit PCM · fixed 20 ms input packets",
    probes: [
      ["Where do the clocks change?", "Opus RTP timestamps use a 48 kHz clock. A 20 ms packet advances by 960 ticks regardless of the decoder output rate. Decode and perform anti-aliased streaming resampling with continuous filter state. Deliver 320 samples or 640 bytes per 20 ms at 16 kHz mono S16; verify channel count, byte order and amplitude."],
      ["What should a loss gap look like to ASR?", "Track timestamps and late packets before decode. Use a bounded reorder/playout window and mark concealment or gaps so downstream timings remain meaningful. Compare the same utterance through clean PCM, the gateway output and mobile capture. Score substitutions, deletions and entity errors by condition."],
      ["How would you trade lookahead for recognition quality?", "Right context is future audio the encoder must wait for. Smaller chunks let the model emit earlier but may increase revisions and per-chunk overhead. Carry encoder/decoder state across chunks. Compare final word error rate, time to a stable word and entity accuracy on disfluencies, accents and noise."]
    ],
    rubric: ["Reconciled the RTP clock, PCM sample count and byte count.", "Distinguished first-chunk fill, lookahead, compute and sustained processing rate.", "Proposed a paired audio replay and quality metrics that isolate the ingress stage."],
    answer: "At the default, four packets yield 80 ms of audio, 1,280 samples and 2,560 PCM bytes. From the first captured sample, four packets plus one packet of right context require 100 ms of audio before a 32 ms computation. The first result is ready at 132 ms under the model. Subsequent chunks overlap the retained lookahead. Compute real-time factor is 32/80 = 0.40. Even a fast average cannot compensate for dropped callback deadlines, wrong sampling rates, or a recognizer repeatedly resetting its state.",
    bridge: "Describe how you would reuse a calling team’s impairment replay corpus to evaluate WER and time to stable text.",
    refs: ["opus","asr","stats"], book: ["networking","Real-time networking"]
  },
  {
    id: "serving", short: "GPU queue & goodput", title: "Which batch policy meets the audio deadline?", minutes: 25, area: "Inference serving",
    lead: "A GPU can finish more work per launch when it batches requests. A user whose audio chunk misses its deadline hears a gap either way.",
    prompt: "One worker receives 24 independent, equal-sized requests from separate streams. Predict what larger batches do under sparse and bursty arrivals. Choose a policy by counting timely completions and examining tail latency. Then remove the assumption that streams are independent.",
    lab: "Replay one GPU queue", model: "FIFO · one non-preemptive worker · 45 ms deadline per request",
    probes: [
      ["How would you schedule production speech streams?", "Track per-session state, ordering and playout slack. Batch eligible chunks across sessions, use a bounded hold, and prevent one long job from monopolizing the worker. For autoregressive decoding, continuous batching can replace finished sequences between steps. A live session needs future chunks before its buffer drains."],
      ["What changes when long prefills arrive?", "A large prompt prefill can hold up active decode steps and cause audible gaps while average throughput looks healthy. Measure queue wait, time to first token and the long tail of inter-chunk gaps separately. Try chunked prefill, a priority class or separate pools; replay the same arrivals to price lost capacity."],
      ["What is your overload policy?", "Estimate capacity with real arrival bursts, sequence lengths, duty cycles and regional skew. Reserve headroom; use queue-age/deadline admission, cancel abandoned work and shed optional generation before buffering indefinitely. Define the fraction meeting latency and quality targets alongside GPU cost per completed audio minute."],
      ["Read a published result. Would you admit 48 streams?", "NVIDIA measured H100 English Parakeet-0.6B-CTC with 160 ms chunks and an n-gram decoder. At 8 streams it reports 7.99× aggregate real-time throughput and 29.5 ms p99 latency. At 48, those become 47.83× and 101.8 ms. For a hypothetical 80 ms p99 target on the same measured stage, 48 fails despite nearly keeping pace. Benchmark smaller pools and bursty arrivals with your own deadline, hardware and speech mix. The table does not measure caller-to-reply latency."]
    ],
    rubric: ["Explained queue wait versus service time for a specific late request.", "Compared policies on the same trace with a tail metric and a deadline count.", "Handled per-stream state, noisy neighbors and overload explicitly."],
    answer: "Full batches amortize the fixed 8 ms launch cost, but the oldest chunk also spends time waiting. Inspect the first late batch and recover its turnaround as finish minus arrival. A hold adds avoidable delay at low arrival rates; under bursts a ready backlog can form batches even with zero intentional wait. For real capacity, measure arrival-to-playout under representative session lengths and cancel rates. This toy trace alone cannot justify a GPU count.",
    bridge: "Relate a media pacer or jitter buffer to a GPU queue. At which boundary would dropping an old item corrupt dependent state?",
    refs: ["bench","batch","role"], book: ["applied","Applied WebRTC"]
  },
  {
    id: "model", short: "Model runtime & profiling", title: "What limits a streaming speech model?", minutes: 25, area: "Model systems",
    lead: "A serving change improves tokens per second. First audio and audible gaps get worse. Work out whether the limiting resource is memory, compute, scheduling or audio generation.",
    prompt: "Budget a transformer’s attention cache, then explain how to find the first bottleneck. The hypothetical GPU has 24 GiB left after weights and fixed reservations. Each sequence has the same context. Treat physical memory pressure and the next audio deadline as separate constraints.",
    lab: "Size the KV cache", model: "32 layers · 8 KV heads · head dimension 128 · batch of independent sequences",
    probes: [
      ["Why profile prefill and decode separately?", "Prefill processes a prompt in parallel and can be compute-heavy. Single-step decode reads weights and prior keys/values repeatedly and can be bandwidth-bound at small batches. Capture shapes, queue and kernel timelines, memory traffic and achieved compute. Determine the bottleneck from measurements before picking fused kernels, quantization or a scheduling change."],
      ["Read a kernel profile. Which optimization has room to help?", "A hypothetical decode step reads 6 GB from DRAM, performs 60 GFLOP and takes 5 ms. Measured sustainable limits are 1.5 TB/s and 120 TFLOP/s. Its arithmetic intensity is 10 FLOP/byte versus a ridge point of 80. The ideal bandwidth lower bound is 4 ms; the compute lower bound is 0.5 ms. Test reducing bytes moved or increasing weight reuse across sequences. Recheck queue delay, actual DRAM traffic, and numerical and speech quality. State whether your units are decimal."],
      ["Would a smaller cache guarantee more usable sessions?", "KV bytes per token = 2 × layers × KV heads × head dimension × bytes per element. Paging can reduce fragmentation; sharing an identical prefix can save repeated blocks. A smaller representation changes scale metadata, accuracy and dequantization cost. Load-test context distributions and compare speech intelligibility, timing and long-turn quality."],
      ["What changes in a speech-native model?", "A cascade exposes ASR text, LLM tokens and TTS audio separately. A duplex speech model can process overlapping audio token streams and preserve prosody, with different state, evaluation and observability. At 12.5 audio frames/s, each frame advances 80 ms of speech. A 110 ms serial step consumes 30 ms of playout reserve; check sustained real-time factor and p99 frame gaps. Some architectures use recurrent state rather than a growing attention cache."]
    ],
    rubric: ["Derived bytes per token using KV heads and both K and V.", "Named a profiling experiment that separates queueing, compute and memory traffic.", "Connected first audio, sustained frame cadence and a speech-quality regression check."],
    answer: "At 2 bytes per element the cache is 131,072 bytes/token. A 4,096-token session therefore uses 512 MiB. With 24 GiB free, 48 is an idealized memory ceiling. Activations, allocator slack and bursts can reduce it; deadlines may bind much sooner. Compare equivalent prompts and outputs, warm and cold runs, then sweep concurrency. An optimization wins only if the intended cohort sees more timely, intelligible audio per unit of cost.",
    bridge: "If asked to optimize a runtime you have never profiled, state the first trace you would collect and the result that would change your mind.",
    refs: ["paged","speech","role"], book: ["media","Media communication"]
  },
  {
    id: "coding", short: "Coding under a deadline", title: "Build a cancellable playout queue", minutes: 30, area: "Coding round",
    lead: "Implement the boundary between a streaming synthesizer and a player. A single late callback from a canceled turn can make an otherwise correct agent speak over its user.",
    prompt: "Download the Python exercise. Implement three methods under the contract in the file. Run its tests, add a race or boundary case of your own, then explain how you would enforce these invariants if callbacks run on different threads.",
    lab: "Run the coding exercise", model: "Python 3.8+ · standard library only",
    probes: [
      ["What invariant belongs at the boundary?", "Only chunks from the active monotonically increasing generation can be queued. Reusing a prior generation after a reconnect breaks this property unless the generation is scoped by a unique call/session ID."],
      ["What happens when the buffer is full?", "The supplied contract rejects a new chunk that would exceed the audio-time budget. A production producer must respond by pausing or canceling, or it will silently lose speech. Measure pending milliseconds and bound memory, in-flight callbacks and the producer’s backlog as well."],
      ["Where is the concurrency boundary?", "Use one event-loop owner or a lock covering generation comparison, duplicate detection and enqueue together. Recheck generation at the last cancellable playout boundary; a dequeued chunk may already be in a device buffer. Use an explicit event to flush or mute that layer and account for its irreducible tail."]
    ],
    rubric: ["Passed the tests, including a stale callback, duplicate and exact capacity boundary.", "Explained the complexity and how state stays bounded during a long call.", "Identified the dequeue/cancel race and described a deterministic test for it."],
    answer: "A FIFO deque, a queued-duration counter and a per-generation sequence high-water mark are sufficient under the ordered-callback contract. Reject invalid input before mutating anything. Only a strictly newer generation flushes the queue. Peek before popping if needed; subtract duration exactly once. Because accepted sequence numbers increase, a single integer suppresses both queued and already-played duplicates. Under arbitrary within-turn reordering you would need a bounded reorder window and a gap deadline instead.",
    bridge: "Explain one case where your choice of synchronization affects the audio callback’s deadline.",
    refs: ["turns"], book: ["data","Data communication"]
  },
  {
    id: "mock", short: "45-minute system design", title: "Design a voice service for 10,000 live calls", minutes: 45, area: "Mock interview",
    lead: "Defend one end-to-end design aloud. A good answer names where an audio sample goes, what state it touches, when the user hears it and what fails first under load.",
    prompt: "You own a regional voice agent reached by browsers and phone callers. Up to 10,000 calls are connected. Target p95 ≤ 650 ms from end of user speech to first audible response and p95 ≤ 150 ms from confirmed interruption to old audio stopping. These targets and workload figures are invented for practice. Choose a cascade or a speech-native stack, give a capacity estimate and defend a rollout.",
    lab: "Change the interviewer’s constraint", model: "5 min requirements · 10 path · 10 sizing · 10 incident · 10 tradeoffs",
    probes: [
      ["Draw the audio and control paths","Place capture or a telephony gateway, a WebRTC media endpoint, codec decode/resampling, streaming inference and return playout. Show where transport encryption terminates for inference. Identify session affinity, single-owner turn state, cancellation and side-effect deduplication. State what happens to partially heard speech on reconnect."],
      ["Size from active work","At 40% input speech duty, 10,000 calls yield 4,000 audio-seconds/s to ASR if silence is gated before inference. At a measured 80 audio-seconds/s per GPU under the required context and quality, and 70% target utilization, the lower-bound pool is ceil(4000/56) = 72 GPUs. If the whole stream is processed, use 10,000 instead. Size TTS and LLM separately. Include bursts, model state, regional headroom and failover."],
      ["Prove the tradeoff","Instrument one correlated turn across media and inference, with a client playout proxy and clock uncertainty. Replay paired workloads and compare p95/p99 latency, spoken-over-user duration, task success, recognition by cohort and cost per served minute. Canary with explicit rollback criteria. Practise stating what remains unknown."]
    ],
    rubric: ["Produced a clocked audio path, a failure boundary and a numerical SLO budget.", "Sized active model work with units, headroom and an assumption worth measuring.", "Handled the injected failure and proposed a controlled experiment plus rollback."],
    answer: "A defensible starting point is a regional media gateway plus a per-call orchestrator that owns the turn ledger. A cascade makes ASR rollback, tool gating and stage timing visible; a native model can exploit prosody and overlap, but needs controls and evals for interruption and external actions. Benchmark both against the same calls. Commit to one topology and justify the boundary, then reopen the decision if measurements violate the target. A strong experience debrief distinguishes your personal decision, the rejected alternative, the observed outcome and its limitations.",
    bridge: "Prepare a 90-second story from real calling work: the symptom, how you isolated it, the decision you owned, the outcome you can substantiate, and what changes once a model sits in the path. Use only details you can share publicly.",
    refs: ["traces","speech","role"], book: ["debugging","Debugging"]
  }
];

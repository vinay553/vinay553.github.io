// Each lesson pairs a guided experiment with a conceptual check and worked problems.
window.chapters = [
{
 id:'overview', nav:'What, why & how', title:'How a WebRTC call works',
 lead:'Follow a call from the first introduction to the first packet. Four jobs let two browsers talk across the internet.',
 lab:'Anatomy of a peer connection', objective:'Trace the four jobs in a call and identify which parts your application owns.',
 parts:[
 ['Two meanings of WebRTC','In browser code, WebRTC is a set of objects and events. On the network, it is a family of protocols. A browser and a native app can talk if they implement compatible protocols. The W3C specifies browser behavior and the IETF specifies much of what travels on the wire.'],
 ['An introduction, then a route','Your app delivers a description of what each side can send or receive. ICE gathers possible addresses and tests pairs for reachability. With trickle ICE, new candidates travel over signaling while checks are already under way. A relay can carry traffic when a direct path fails.'],
 ['One connection, two kinds of payload','DTLS establishes keys on the chosen transport. Audio and video use SRTP, with RTCP feedback protected as SRTCP. A data channel carries messages using SCTP inside DTLS. A call can have tracks, channels, or both.'],
 ['From a drawing to browser calls','Create an RTCPeerConnection on each side. Use addTrack or createDataChannel before making an offer. createOffer builds a description and setLocalDescription applies it. Deliver it to the other side, apply it with setRemoteDescription, and return an answer. Deliver new candidates to addIceCandidate. A track event announces a receiving track; the first rendered frame can arrive later.']
 ],
 quiz:['Which part is your application responsible for providing?',['Delivering offers, answers and candidates','Implementing the SRTP cipher','Reordering SCTP chunks'],0,'WebRTC exposes descriptions and candidate events. Your app chooses how to deliver them to the other peer.'],
 work:[['Trace a data-only call','Write the four jobs in order. Name the protocol that carries a chat message after setup.','The app exchanges descriptions, ICE finds a working pair, DTLS establishes keys, and SCTP carries the message inside DTLS. Candidate exchange can overlap the first two jobs.'],['Follow one camera frame','Which servers need to see the frame if a direct candidate pair succeeds? What changes if only a relay pair works?','On a direct path the signaling service can finish its job without receiving media. With TURN the relay forwards encrypted packets between the peers.']]
},
{
 id:'signaling',nav:'Signaling',title:'Agree on a session',
 lead:'Before sending a frame, the peers need a shared vocabulary. Offer and answer describe what each side can actually use.',
 lab:'Negotiate a video codec',objective:'Read an SDP media section and predict which configurations an answer can accept.',
 parts:[
 ['Signaling is an application channel','Both peers need a way to exchange session descriptions and ICE candidates. A WebSocket, an HTTP service, or even a manual exchange can convey them. The signaling server may help users find each other before any WebRTC transport exists.'],
 ['Read an SDP from the outside in','Session-level lines apply across the description. An m= line starts a media section. Its a=mid label lets later messages identify that section. BUNDLE groups sections on a shared transport. Within each section, rtpmap maps a negotiated payload number to a codec and clock rate; fmtp supplies codec parameters.'],
 ['An offer proposes; an answer selects','An RTP transceiver pairs a sender and a receiver. Its direction constrains what the other side can accept. A sendonly video offer can receive a recvonly or inactive answer. Reusing a payload number from a different call is unsafe because the mapping is negotiated per session.'],
 ['Separate identity from reachability','ICE credentials authenticate connectivity checks and candidate lines describe possible routes. The DTLS fingerprint identifies the expected certificate, while setup helps negotiate client/server roles. Adding a screen-sharing transceiver later can require a new offer and answer.']
 ],
 quiz:['A sendonly video offer advertises VP8 and H.264. The answerer can only decode VP8. Which answer works?',['sendonly H.264','recvonly VP8','sendrecv AV1'],1,'Both the codec and the direction must be compatible with the offer.'],
 work:[['Decode a payload number','An offer contains “a=rtpmap:96 VP8/90000”. What does 96 tell a receiver? Can a second call assign it to another codec?','96 identifies VP8 within this negotiated mapping. 90000 is the RTP clock rate in ticks per second. A different session may map 96 differently.'],['Design a renegotiation','Two peers already exchange audio. One adds a screen-sharing track on a new transceiver. Describe the next signaling round.','The new sender applies and sends an updated offer with a video section. Its peer applies it, chooses a compatible direction and codec, and returns an answer. ICE may reuse the existing bundled transport.']]
},
{
 id:'connecting',nav:'Connecting',title:'Find a route that works',
 lead:'A local address is only a proposal. ICE tests candidate pairs until it finds a path on which both peers can exchange packets.',
 lab:'Choose an ICE path',objective:'Distinguish discovering a public address from proving end-to-end connectivity.',
 parts:[
 ['Mapping and filtering do different jobs','A NAT maps a private address and port to an external pair. A filtering rule decides which incoming traffic can use that mapping. A mapping may change with the destination, and idle mappings can expire. Two machines knowing their public addresses still might have no direct path.'],
 ['Gather candidates','A host candidate represents a local interface and may be advertised by an mDNS name. A STUN Binding response reports the address the server observed, giving a server-reflexive candidate. Authenticated checks may uncover a previously unknown peer-reflexive address. STUN uses transaction IDs to match replies to requests.'],
 ['Test and nominate a pair','ICE pairs compatible local and remote candidates, prioritizes the pairs and runs STUN connectivity checks. The controlling agent nominates a successful pair. When the network changes, an ICE restart uses new credentials to run checks again.'],
 ['When the direct route fails','A TURN server allocates a relayed address. The client creates permission for the peer, can bind a channel to reduce overhead, and refreshes the allocation. Either end can use a relay. It costs bandwidth at the server and may increase delay.']
 ],
 quiz:['A STUN server returns your public address. What has that proved?',['The remote peer can reach you','The server saw a packet from that mapped address','TURN will never be needed'],1,'The mapping is an observation from the STUN server. A successful peer connectivity check supplies stronger evidence.'],
 work:[['Change the network','Compare a shared LAN with the restricted-network preset. Turn the relay off and predict the result before checking.','The modeled LAN permits a host pair. The restricted network blocks direct pairs. An available relay produces a viable path; disabling it leaves no successful pair in this model.'],['Recover after roaming','A phone switches from Wi-Fi to cellular. Why might resending the old public address fail? What can ICE do?','The address, interface and NAT mapping may all have changed. Restart ICE, exchange fresh credentials and candidates, then check and nominate a viable pair.']]
},
{
 id:'securing',nav:'Securing',title:'Trust the peer and protect the packets',
 lead:'A working network path tells you where packets can go. A certificate check and key agreement tell you who can read them.',
 lab:'Verify the peer fingerprint',objective:'Explain how signaling, DTLS and SRTP work together to establish trust.',
 parts:[
 ['Keys, hashes and proof','Encryption protects plaintext with a key. A hash makes a digest; a keyed message authentication code lets a receiver verify integrity and possession of a secret. A signature can be checked using a public key. Fresh nonces and distinct keys for each direction help separate different uses.'],
 ['Bind the handshake to signaling','The remote description contains a fingerprint of the expected certificate. Each side compares that value with the certificate actually presented over DTLS. This binds the two exchanges only if the signaling information itself is trustworthy. A TURN relay can forward encrypted traffic without learning the endpoint keys.'],
 ['Read a DTLS handshake','The chapter traces DTLS 1.2. Hello messages negotiate options, and the cookie exchange can verify return reachability. The peers exchange certificate and key-agreement material, derive traffic keys, then verify the transcript with Finished messages. Datagram loss requires retransmitting handshake flights. Newer protocol versions have different message sequences.'],
 ['Protect messages and media','SCTP data travels inside protected DTLS records. For media, DTLS exports key material to SRTP and SRTCP. SRTP combines the packet sequence number and a rollover counter to form a longer packet index. Authentication and replay checks use this state across a 16-bit sequence wrap.']
 ],
 quiz:['The DTLS certificate fingerprint differs from the expected SDP value. What should the endpoint do?',['Accept if ICE succeeded','Switch codecs','Stop establishing this secure connection'],2,'Successful ICE checks say the path works. They cannot authenticate a certificate that fails the fingerprint check.'],
 work:[['Explain the trust boundary','A relay forwards every packet. Under ordinary TURN, which components have the media keys? How does a conventional SFU differ?','Endpoints derive SRTP keys through DTLS. TURN forwards protected traffic. A conventional SFU terminates each hop and holds hop keys unless the application adds a separate end-to-end encryption layer.'],['Follow a rollover','A receiver sees RTP sequence numbers 65534, 65535, 0, 1 from one source. Why keep a rollover counter?','The short sequence number wraps normally. With rollover state, SRTP can construct an extended packet index and distinguish new packets from old ones.']]
},
{
 id:'networking',nav:'Real-time networking',title:'Deliver before the deadline',
 lead:'A packet can arrive intact and still be useless. Play with a receiver’s deadline to see what real-time networking optimizes.',
 lab:'Tune a jitter buffer',objective:'Trade latency against late loss and choose a repair strategy that can meet a deadline.',
 parts:[
 ['Delay, variation and loss','Bandwidth is a rate; propagation, serialization and queues contribute to delay. RTT measures a round trip. Half of it estimates one-way delay only when the paths are similar. Jitter is variation in arrival timing. The MTU limits packet size on a link, and fragmentation makes a packet vulnerable to the loss of any fragment.'],
 ['A receiver spends time to smooth timing','A jitter buffer schedules playout against a media clock. Giving arrivals extra time can absorb variation and reordering. That extra time also delays every frame. A packet that misses its deadline counts as late even if the network eventually delivers it.'],
 ['Repair has a price','A cumulative ACK confirms a contiguous prefix. A selective ACK can also report received ranges. A NACK asks for a missing unit; retransmission helps when enough time remains. Forward error correction sends redundancy in advance so recovery can succeed without waiting a round trip.'],
 ['Congestion needs a feedback loop','Increasing queue delay, reported loss or congestion markings can signal an overloaded path. Pacing avoids bursts. A file sender can slow down and finish later, while a live encoder can lower its bitrate or resolution to preserve freshness. Network capacity can change mid-call.']
 ],
 quiz:['A frame expires in 35 ms. A retransmission is expected in 70 ms. Which conclusion follows?',['Retransmission will repair this frame in time','Recovery would miss this frame’s deadline','A larger packet removes the delay'],1,'Compare the repair time to the remaining playout budget. A later frame may be a better use of bandwidth.'],
 work:[['Find the minimum buffer','In the lab, determine the smallest whole-millisecond buffer that delivers all four packets. Show your subtraction.','Arrival minus send gives 25, 46, 19 and 29 ms. The largest is 46 ms, so a 46 ms buffer accepts all four, with equality counted as on time.'],['Choose a repair','Compare an audio call with 20 ms left for a repair to a download with no playout deadline. When would you pay for FEC?','If a round trip is longer than 20 ms, pre-sent redundancy can help the call where a retry arrives too late. The download can wait for retransmission and avoid the constant redundancy overhead.']]
},
{
 id:'media',nav:'Media communication',title:'Turn packets back into pictures',
 lead:'A video call sends fragments of compressed frames. The receiver has to assemble, decode and play them while the clock keeps moving.',
 lab:'Recover a damaged video sequence',objective:'Choose between a packet repair and a picture refresh using frame dependencies and available time.',
 parts:[
 ['Compress with the future in mind','Lossless encoding permits exact reconstruction. Lossy codecs discard selected detail to save bits. An intra frame can be decoded independently; predicted frames depend on reference pictures. B-frames can reference pictures on both sides in display order, adding reordering delay. Interactive encoders often avoid that extra wait.'],
 ['Read an RTP packet','The SSRC identifies a source. The payload type maps to a negotiated format. Sequence numbers advance per packet; timestamps identify positions on the media clock. Several packets from one video frame can share a timestamp. Header extensions carry negotiated metadata, and a mixer may list contributing sources.'],
 ['Use RTCP to learn what arrived','Sender reports relate RTP timestamps to a common time reference. Receiver reports describe loss and jitter. NACK identifies missing packets. A PLI says the receiver needs a picture refresh; a FIR explicitly requests a decoder refresh with request sequencing. A fresh independent frame costs bits but can break a chain of corruption.'],
 ['Adapt the encoder','A receiver can send a bitrate estimate with REMB, or send packet arrival feedback with transport-wide congestion control so the sender can estimate capacity. GCC is an estimator/controller, separate from the feedback format. TMMBR requests a temporary bitrate ceiling and TMMBN communicates the bounding set. FEC and retransmission also consume some of the available rate.']
 ],
 quiz:['Three RTP packets carry fragments of one video frame from one source. Which field normally differs across all three?',['RTP sequence number','Frame timestamp','SSRC'],0,'Each packet has a sequence number. Fragments of the same frame can share the source and timestamp.'],
 work:[['Repair under a budget','Run the lab with a missing P-frame fragment and 35 ms until playout. Compare a 20 ms retry with a 70 ms retry.','At 20 ms the repair meets the modeled deadline. At 70 ms it misses. A picture refresh can restore decoding from a later independent frame, but cannot make the missed frame timely.'],['Synchronize a microphone and camera','Audio runs at 48 kHz and video at 90 kHz. Why can’t you compare their raw RTP timestamps directly?','The clocks have different rates and origins. RTCP sender reports map each RTP clock to a shared time reference so the receiver can align presentation.']]
},
{
 id:'data',nav:'Data communication',title:'Choose how messages arrive',
 lead:'A file needs every byte. A cursor needs the latest position. Data channels let those two workloads make different promises.',
 lab:'Lose a message on purpose',objective:'Separate ordering from reliability and trace one message through DCEP, SCTP and DTLS.',
 parts:[
 ['An association contains streams','SCTP preserves message boundaries and can fragment a message into DATA chunks. A transmission sequence number tracks each DATA chunk across the association. A stream ID selects a stream, the stream sequence orders messages in classic ordered DATA, and a payload protocol identifier distinguishes payload types such as text and binary.'],
 ['Open a channel','SCTP establishes the association with INIT, INIT ACK, COOKIE ECHO and COOKIE ACK. For an in-band channel, DCEP sends OPEN with a label, protocol and delivery policy, followed by ACK. Applications can instead agree on a channel ID out of band and create a negotiated channel at both ends.'],
 ['Choose two independent policies','Ordered delivery can hold a later message behind a missing earlier one on that stream. Unordered delivery permits a complete later message to pass. Reliability may be full or limited by a retry count or a lifetime. The browser API allows one of maxRetransmits and maxPacketLifeTime on a channel.'],
 ['Recover, skip, close','SACKs describe contiguous data and gaps. With partial reliability, FORWARD TSN lets a receiver advance past abandoned data. HEARTBEAT tests path liveness. ERROR reports a problem, ABORT terminates abruptly, and SHUTDOWN coordinates an orderly finish. Flow and congestion control still apply.']
 ],
 quiz:['Which policy fits positions where a newer update supersedes an older one?',['Ordered with unlimited retries','Unordered with a small retry or lifetime budget','Ordered with both retry and lifetime limits set'],1,'Fresh independent updates can bypass gaps, and a bounded repair policy avoids spending too long on stale messages.'],
 work:[['Predict delivery order','Send 1, 2, 3. Number 2 is lost on its first attempt. Give the immediate and final delivery order for reliable ordered and reliable unordered channels in the model.','Ordered initially delivers 1, then releases 2 and 3 after repair. Unordered delivers 1 and 3 immediately, then 2 after repair.'],['Design two channels','Pick settings for a photo and a live cursor. How would you avoid filling the browser’s send buffer with the photo?','Use reliable delivery for the photo and an unordered, bounded-retry channel for cursor updates. Chunk the photo, watch bufferedAmount, and resume queued sends on bufferedamountlow.']]
},
{
 id:'applied',nav:'Applied WebRTC',title:'Design a room for more than two',
 lead:'Adding people changes who uploads, who decodes, and who pays for bandwidth. Move the work around a room and measure the result.',
 lab:'Compare conference topologies',objective:'Calculate client and server bandwidth for a specified topology and subscription policy.',
 parts:[
 ['Start with the product','Conferencing needs two-way conversation. A broadcast favors one-to-many delivery. Remote access combines screen video with input messages. Sensors and file transfer favor data channels. Teleoperation adds tight latency requirements. A gateway can translate media or application protocols, and a peer-assisted CDN can reduce repeated downloads on a local network.'],
 ['Direct and mesh','A one-to-one call has a single peer relationship. In a full mesh, each of n people connects to n−1 others. There are n(n−1)/2 links. A hybrid mesh lets selected peers forward to neighbors, saving some uplink at the cost of extra hops and dependence on those forwarders.'],
 ['Forward encoded tracks','A selective forwarding unit (SFU) receives a stream and forwards selected tracks or layers. Subscribers can choose who to see. Sending multiple simulcast layers changes publisher cost. A TURN relay moves transport packets for a peer connection; it does not implement conference subscriptions.'],
 ['Mix a new stream','A multipoint control unit (MCU) decodes incoming media, composes it, and encodes output. This can reduce client download and decoding work but shifts compute, composition and latency to the server. Traditional SFUs and MCUs terminate hop encryption and have different trust boundaries from direct peers.']
 ],
 quiz:['Six people each publish one 1 Mb/s stream in a full mesh. What does each participant upload?',['1 Mb/s','5 Mb/s','15 Mb/s'],1,'Each of the six sends five copies. The room has fifteen bidirectional peer relationships.'],
 work:[['Budget an all-hands room','Set six participants. Predict server egress with an all-subscribed SFU and with a single 1 Mb/s composite per MCU client.','The SFU sends 6 × 5 × 1 = 30 Mb/s. The MCU sends 6 × 1 = 6 Mb/s under the stated model and performs composition and encoding.'],['Choose an architecture','A classroom has one teacher on camera, thirty viewers and occasional questions. Which assumptions in the lab would you change?','Subscription is asymmetric. One published teacher track can be forwarded to thirty viewers; enable student publication only when needed. All-to-all upload and download formulas overestimate this room.']]
},
{
 id:'debugging',nav:'Debugging',title:'Find the first broken handoff',
 lead:'“The call is broken” is an observation. A diagnosis starts with the earliest layer whose input arrived and whose expected output did not.',
 lab:'Read a call’s evidence',objective:'Use state transitions and interval statistics to isolate a failure and design one confirming test.',
 parts:[
 ['Follow the call in order','Check whether signaling delivered the descriptions and candidates. Check whether ICE selected a working pair, then whether DTLS connected. Finally check RTP counters or channel state. A connected transport can carry zero useful media. A muted output, decoder issue or missing sender can all look like a blank tile.'],
 ['Use tools on a call you control','Browser WebRTC internals and RTCPeerConnection.getStats() expose candidate pairs, transport state and per-stream counters. Correlate STUN requests with responses by transaction ID. A capture of your own call can confirm packet timing even when its payload is encrypted. Compare observations at both endpoints.'],
 ['Read the interval, not the lifetime total','Subtract two counter readings from the same stats object. A rising NACK count shows repair requests. A rising PLI count indicates that picture refreshes were requested. For mean jitter-buffer residence over an interval, divide the change in jitterBufferDelay by the change in jitterBufferEmittedCount. Skip an interval with a zero denominator.'],
 ['Measure glass-to-glass delay','Camera capture, encoding, queues, transport, buffering, decoding and display all contribute. Filming a clock and comparing its local and rendered readings measures a wider path than RTT. Frame callbacks and timestamps can refine an estimate if their clocks and measurement endpoints are understood.']
 ],
 quiz:['A local clock shows 12.480 s while its remote video shows 12.308 s. What did you measure?',['172 ms glass-to-glass delay','86 ms one-way network time','172 ms RTT'],0,'Subtracting the readings captures the delay across the whole observed video pipeline.'],
 work:[['Explain a black tile','ICE and DTLS are connected, inbound RTP bytes rise, but framesDecoded stays flat. Where would you look next?','Inspect video payload type and codec mapping, complete-frame assembly, dependency on a keyframe and decoder errors. The arriving bytes show that the earlier transport stages work.'],['Compute buffer residence','Over one interval, jitterBufferDelay rises from 9.4 to 11.0 seconds and jitterBufferEmittedCount rises from 300 to 340. Find the mean.','1.6 seconds divided by 40 emitted units gives 0.040 seconds, or 40 ms per unit. It is one contributor to total delay.']]
},
{
 id:'history',nav:'History',title:'How the pieces came together',
 lead:'WebRTC grew out of packet audio, experimental video tools and years of browser work. Two interviews explain the choices behind the stack.',
 lab:'Explore the WebRTC timeline',objective:'Connect the design of RTP and the split between browser APIs and wire protocols to the problems that motivated them.',
 parts:[
 ['Before a browser could call','Ron Frederick describes building nv, an early network video tool, when software compression and the available hardware were tight constraints. MBone experiments used multicast to carry media to groups. Several tools needed shared timing and source conventions.'],
 ['A common packet vocabulary','RTP gave different media senders and receivers common sequence numbers, timestamps, source identifiers and a companion control protocol. The first RTP RFC appeared in 1996. The payload format can evolve while these conventions still help receivers reconstruct timing.'],
 ['From installed clients to browsers','Serge Lachapelle recalls Marratech, its acquisition by Google in 2007 and the Gmail voice and video plug-in. Browser integration reduced the need for users to install a separate calling plug-in. Codec and media-engine work, including On2 and GIPS, contributed pieces of the stack.'],
 ['Divide the standardization work','Discussions in Maastricht in 2010 helped shape the project. The IETF worked on interoperable wire behavior and the W3C on browser-facing APIs. Leaving application signaling open let calling services keep their own ways of finding users, inviting them and controlling rooms.']
 ],
 quiz:['Why leave the application signaling transport open?',['To avoid exchanging descriptions','To let services define invitations and room control while using compatible media transports','To make RTP require multicast'],1,'Interoperable peers can exchange descriptions over different application-selected delivery systems.'],
 work:[['Compare two ways to fan out','What has to cooperate for network multicast to save bandwidth? How does a modern SFU fan out a stream?','Multicast requires support along the network delivery tree. An SFU receives a publisher’s stream and sends selected copies over individual peer connections.'],['Separate the standards','Place RTP, the JavaScript RTCPeerConnection API, and a room invitation into the IETF, W3C, and application layers.','RTP is an IETF protocol. RTCPeerConnection is a W3C browser API. Invitations and room membership belong to the application.']]
},
{
 id:'faq',nav:'FAQ',title:'Test the shortcuts people repeat',
 lead:'“WebRTC is UDP” and “unordered means unreliable” each leave out an important choice. Practice making those choices explicit.',
 lab:'Check a common claim',objective:'Resolve questions about latency, bandwidth, binary data and channel limits from the underlying mechanism.',
 parts:[
 ['Transport and latency','UDP gives the real-time stack control over deadlines and retransmission. WebRTC can use alternatives, including TURN over TCP or TLS when UDP is blocked. Latency varies with capture, encoding, the network, buffering and display. Measure the stages relevant to your use case.'],
 ['Rate and channel count','Congestion control adapts media and data to the path. It cannot promise a fixed speed. An SCTP stream identifier can range from 0 through 65534 for a data channel; the negotiated number of usable channels may be much lower. Inspect the connection’s SCTP transport and its maxChannels value.'],
 ['Binary and unordered messages','Send text or binary objects through a data channel. Select unordered delivery for independent or superseding updates even when every message must eventually arrive. Sending encoded video as arbitrary bytes leaves timing, buffering, decoding and rendering to your application. Media tracks already provide that pipeline.']
 ],
 quiz:['What does an unordered, reliable channel promise while the association remains healthy?',['Every message is attempted only once','Delivery with retries, without an in-order delivery requirement','A fixed delay per message'],1,'Reliability controls repair. Ordering controls whether a completed later message must wait behind a gap.'],
 work:[['Answer the product manager','A feature spec promises exactly 100 ms camera-to-screen delay on every connection. What would you measure and report instead?','Measure end-to-end delay on representative devices and paths; report percentiles, capture settings, relay use and load. A single universal time cannot describe the whole pipeline.'],['Send a recording versus a call','Choose a channel for sending a completed audio recording and another for a live conversation. Justify both.','A reliable binary data channel can transfer the recording as a file. A live audio track supplies a codec, RTP timing, jitter buffering and playout.']]
},
{
 id:'glossary',nav:'Glossary',title:'Speak the language of a call',
 lead:'Look up the book’s vocabulary, then practice telling apart terms that sound similar but answer different questions.',
 lab:'Protocol dictionary',objective:'Identify a term by the job it does and distinguish it from its nearest neighbor.',
 parts:[
 ['Group by what the term describes','SDP describes a session, ICE tests paths, and DTLS authenticates and establishes keys. RTP carries timed media; RTCP reports on it. SCTP gives application messages their delivery behavior. Sorting by job is more useful than memorizing expansions alone.'],
 ['Ask what is being counted','An SSRC identifies a media source. An RTP sequence number counts packets from that source. An RTP timestamp places media samples on a clock. An SCTP TSN numbers a DATA chunk across an association. These values belong to different layers.']
 ],
 quiz:['Which pair distinguishes “please resend a packet” from “I need a decodable picture”?',['NACK and PLI','SDP and ICE','RTT and MTU'],0,'NACK supplies loss feedback about a packet. PLI signals a picture loss that may require a refresh.'],
 work:[['Describe one failure three ways','Use the terms jitter, NACK and PLI in three sentences about a damaged stream.','Variable arrival timing increases jitter. A receiver can NACK a missing packet. If reference damage prevents decoding, it may send a PLI to request a refresh.'],['Compare identities','A trace shows SSRC, MID and TSN. Explain what each identifies or numbers.','SSRC identifies an RTP source. MID labels a negotiated media section. TSN tracks an SCTP DATA chunk within its association.']]
},
{
 id:'reference',nav:'Standards reference',title:'Go from a question to a standard',
 lead:'Use the book’s reference chapter as a map. The right document depends on whether your question is about a browser object or bytes on the wire.',
 lab:'Find the right specification',objective:'Locate a primary specification and follow its update or obsolescence chain.',
 parts:[
 ['Begin with the boundary','The W3C WebRTC specification defines browser interfaces, events and state. The IETF WebRTC overview, RFC 8825, maps the protocol family. Questions about a particular field or handshake usually lead to a narrower RFC.'],
 ['Follow the protocol','Use RFC 8445 for ICE, RFC 8489 for STUN, and RFC 8656 for TURN. RTP and RTCP share RFC 3550. For data channels, RFC 8831 gives the architecture, RFC 8832 defines DCEP, and RFC 9260 specifies SCTP. SDP syntax and WebRTC offer/answer procedures have separate documents.'],
 ['Check the document’s status','RFC numbers are immutable identifiers; later documents can update or obsolete their predecessors. Read the RFC Editor status header, errata and update links. A newer protocol specification does not establish which versions a particular deployment actually negotiated.']
 ],
 quiz:['Which document tells you how a DCEP OPEN message is represented on the wire?',['The W3C specification alone','RFC 8832','RFC 3550'],1,'RFC 8832 defines the Data Channel Establishment Protocol, including the OPEN and ACK message formats.'],
 work:[['Trace a browser method','Find createDataChannel in the W3C specification. Then open the DCEP specification. Write one question each source can answer.','W3C explains the method’s arguments and observable behavior. RFC 8832 explains how a channel label and reliability parameters are encoded for the peer.'],['Follow a replacement','Start at RFC 4960 and follow the “Obsoleted by” link. Which spec would you cite for the current SCTP base protocol?','RFC 9260 replaces RFC 4960. Keep the historical reference when explaining older implementations, and consult the newer status page for current updates.']]
}
];

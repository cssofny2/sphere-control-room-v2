// Original, clean lab humour for Dr. Wire. Never used during alarms or safety events (see dialogue.ts).
export type JokeTopic = 'general' | 'vacuum' | 'clock' | 'laser' | 'vna' | 'stage' | 'data' | 'thermal';
export type Joke = { text: string; topic: JokeTopic };

export const NEW_JOKES: Joke[] = [
  // general
  { topic: 'general', text: "My sphere and I have a lot in common. We both ring when someone pokes us." },
  { topic: 'general', text: "I tried to keep a lab notebook tidy once. Entropy filed a complaint." },
  { topic: 'general', text: "Every good experiment has three parts: a hypothesis, a method, and somewhere to hide the coffee." },
  { topic: 'general', text: "I measure twice and cut once. Then I measure again, because I don't trust the cut." },
  { topic: 'general', text: "A good technician is like a good vacuum: you only notice when something leaks." },
  { topic: 'general', text: "My favourite unit is the coffee. It's about 250 millilitres of motivation." },
  { topic: 'general', text: "In this lab, 'it's probably fine' is not a measurement." },
  { topic: 'general', text: "I named the sphere Sphere. I'm not proud of the creativity, but it's consistent." },
  { topic: 'general', text: "Peer review is just a polite way of saying 'show me the error bars'." },
  { topic: 'general', text: "If you ever feel unimportant, remember: someone calibrated a ruler so you could measure things." },
  { topic: 'general', text: "I used to be a wireframe. Now I'm fully rendered, and somehow I still can't find my keys." },
  { topic: 'general', text: "I'm outstanding in my field. The field is a magnetic one, and I'm shielded from it." },
  { topic: 'general', text: "Replication is the sincerest form of science." },
  { topic: 'general', text: "The best lab safety tip: if you wonder whether you need goggles, you need goggles." },
  { topic: 'general', text: "A physicist's idea of a quick fix is a piece of tape and a very confident tone." },
  { topic: 'general', text: "Never underestimate a lab with a label maker. Everything in here has been officially named." },
  // vacuum
  { topic: 'vacuum', text: "The vacuum pump and I get along. We both suck at small talk." },
  { topic: 'vacuum', text: "Nature abhors a vacuum, but the turbo is very persuasive." },
  { topic: 'vacuum', text: "The chamber is so empty it has started echoing. Actually no, there's nothing to carry the echo." },
  { topic: 'vacuum', text: "What do you call a polite molecule in a vacuum chamber? Leaving soon." },
  { topic: 'vacuum', text: "Roughing pump to turbo: 'You take it from here.' Turbo: 'Say no more, I'll spin on it.'" },
  { topic: 'vacuum', text: "A vacuum leak is just the chamber's way of saying it misses the atmosphere." },
  { topic: 'vacuum', text: "Deep vacuum is the only place I've seen a truly quiet meeting." },
  { topic: 'vacuum', text: "Pressure gauges are honest. They never pretend things are under control when they aren't." },
  // clock
  { topic: 'clock', text: "Our rubidium clock has never been late. I envy that." },
  { topic: 'clock', text: "Time flies when you're locked to a rubidium reference. So does the tolerance." },
  { topic: 'clock', text: "10 megahertz means ten million ticks a second. I can't even keep up with one." },
  { topic: 'clock', text: "Holdover mode: when the clock says 'trust me, I remember what time it was'." },
  { topic: 'clock', text: "The clock and the VNA share a reference. It's the most synchronised relationship in the building." },
  { topic: 'clock', text: "Rubidium atoms keep better time than my calendar app." },
  { topic: 'clock', text: "The only thing I'd happily wait for is a clock lock. Everything else I'd microwave." },
  // laser
  { topic: 'laser', text: "The laser vibrometer is great at parties. It notices every little shake." },
  { topic: 'laser', text: "Good laser etiquette: never point it at anything you wouldn't like to be interfered with." },
  { topic: 'laser', text: "The beam and the sphere are in a committed relationship. It's all about reflection." },
  { topic: 'laser', text: "A vibrometer measures motion smaller than the width of an atom, and I still drop my keys." },
  { topic: 'laser', text: "Laser safety goggles: because the only thing I want to see in the beam is my own enthusiasm." },
  { topic: 'laser', text: "Interferometry is basically two light waves arguing until we learn something." },
  { topic: 'laser', text: "Doppler vibrometry: the art of knowing how fast something shakes without ever touching it." },
  // vna
  { topic: 'vna', text: "A VNA is just a very sophisticated way of asking, 'Hello? Can you hear me?'" },
  { topic: 'vna', text: "The S11 dip is the sphere's way of saying, 'Yes, that frequency is mine.'" },
  { topic: 'vna', text: "Calibration is the VNA's way of saying 'I promise to stop blaming the cables'." },
  { topic: 'vna', text: "A narrow IFBW gives a quiet trace. It's the library of bandwidths." },
  { topic: 'vna', text: "Why was the trace so calm? It had a proper reference plane." },
  { topic: 'vna', text: "Smith charts look like abstract art until they save your afternoon." },
  { topic: 'vna', text: "Averaging is the art of agreeing with yourself until the noise gives up." },
  // stage
  { topic: 'stage', text: "The stage moves in micrometres. I move in coffee-powered shuffles." },
  { topic: 'stage', text: "Backlash is just the stage hesitating before committing to a direction." },
  { topic: 'stage', text: "Homing the stage: because it deserves a place to call zero." },
  { topic: 'stage', text: "Settling time is when everyone finally stops fidgeting." },
  { topic: 'stage', text: "Three axes, thirty-five millimetres each, and a whole lot of patience." },
  { topic: 'stage', text: "The stage is the only thing in the lab that moves with purpose. I envy the focus." },
  // data
  { topic: 'data', text: "Data without error bars is just a rumour with a graph." },
  { topic: 'data', text: "A single data point is a story. Two is a coincidence. Five with a randomised order is science." },
  { topic: 'data', text: "My favourite cluster is a tight one with low uncertainty." },
  { topic: 'data', text: "Statistics: the science of being confidently approximate." },
  { topic: 'data', text: "Outliers aren't wrong. They're just points with a strong personality." },
  { topic: 'data', text: "I never delete data. I just mark it 'to be argued about later'." },
  { topic: 'data', text: "Blind validation is the only time I'm happy not knowing the answer." },
  // thermal
  { topic: 'thermal', text: "Thermal stability is the art of staying calm while everything else warms up." },
  { topic: 'thermal', text: "Heat flows from hot to cold. Cold takes its time to say thank you." },
  { topic: 'thermal', text: "If the temperature drifts, blame the sun. If it doesn't, blame the thermostat anyway." },
  { topic: 'thermal', text: "A millikelvin is a very small amount of warmth. Like a hug from a robot." },
  { topic: 'thermal', text: "The sphere's resonance follows the temperature. It's the friend who copies everything you do." },
];

if (NEW_JOKES.length < 60) throw new Error('Need at least 60 jokes');

// Text pools for the heavy seed. Everything here is invented: names are common
// first and last names from each kennel's country, hash handles are the
// affectionate nonsense hashers give each other.

export interface NamePool {
  country: string;
  female: string[];
  male: string[];
  last: string[];
}

export const NAME_POOLS: Record<string, NamePool> = {
  Nigeria: {
    country: 'Nigeria',
    female: ['Chioma', 'Adaeze', 'Yetunde', 'Ireti', 'Funmi', 'Halima', 'Hauwa', 'Ifeoma', 'Nkechi', 'Titi', 'Sade', 'Uchenna', 'Bukola', 'Damilola', 'Efe', 'Gift', 'Ronke', 'Tosin'],
    male: ['Chinedu', 'Obinna', 'Kunle', 'Femi', 'Bayo', 'Sule', 'Musa', 'Ibrahim', 'Tobi', 'Dayo', 'Nnamdi', 'Kelechi', 'Yusuf', 'Gbenga', 'Chukwudi', 'Ade', 'Lanre', 'Ikenna'],
    last: ['Okafor', 'Adebayo', 'Balogun', 'Okonkwo', 'Ibrahim', 'Olawale', 'Umeh', 'Danjuma', 'Lawal', 'Afolabi', 'Onyeka', 'Ogunleye', 'Nnadi', 'Akinola', 'Eze', 'Chukwu', 'Abubakar', 'Salami'],
  },
  Ghana: {
    country: 'Ghana',
    female: ['Ama', 'Abena', 'Akosua', 'Efua', 'Adwoa', 'Esi'],
    male: ['Kofi', 'Kwame', 'Yaw', 'Kwabena', 'Kojo', 'Nii'],
    last: ['Mensah', 'Owusu', 'Boateng', 'Asante', 'Appiah', 'Darko', 'Ofori', 'Quaye'],
  },
  Kenya: {
    country: 'Kenya',
    female: ['Wanjiru', 'Achieng', 'Njeri', 'Atieno', 'Wambui', 'Akinyi'],
    male: ['Otieno', 'Kamau', 'Mwangi', 'Kiplagat', 'Kibet', 'Omondi'],
    last: ['Odhiambo', 'Kariuki', 'Waweru', 'Kipchoge', 'Mutua', 'Wekesa', 'Ochieng', 'Njoroge'],
  },
  Rwanda: {
    country: 'Rwanda',
    female: ['Uwase', 'Ingabire', 'Mukamana', 'Umutoni', 'Uwimana'],
    male: ['Mugisha', 'Habimana', 'Kamanzi', 'Iradukunda', 'Niyonzima'],
    last: ['Nkurunziza', 'Uwimana', 'Niyonzima', 'Mukamana', 'Habiyaremye', 'Ndayisaba'],
  },
  'South Africa': {
    country: 'South Africa',
    female: ['Lerato', 'Naledi', 'Annelie', 'Zanele', 'Thandi', 'Karien'],
    male: ['Thabo', 'Sipho', 'Pieter', 'Bongani', 'Johan', 'Themba'],
    last: ['Nkosi', 'Dlamini', 'van der Merwe', 'Botha', 'Khumalo', 'Naidoo', 'Pretorius', 'Mokoena'],
  },
};

export const HASH_HANDLES = [
  'Mud Flap', 'Beer Goggles', 'Hill Billy', 'Shortcut Sam', 'Soggy Bottom', 'Back Check Charlie', 'Loose Boots',
  'Torch Bearer', 'Bush Telegraph', 'Gin Gin', 'Late Again', 'Two Left Feet', 'Dry Cleaner', 'Cold Beer Cora',
  'Slow Mo', 'Jollof Jedi', 'Hare Brained', 'Puddle Jumper', 'Pepper Soup', 'Mama Put', 'Kilometer Kobo',
  'Shiggy Mama', 'Okada', 'Suya Spot', 'Wrong Turn Wale', 'Chalk Talk', 'False Prophet', 'Dead Hare Dave',
  'Lanky', 'Boots Off', 'Compass Rose', 'Sweaty Betty', 'Downhill Dan', 'Zobo', 'Garri Gang', 'Trail Mix',
  'Tipsy Tolu', 'Night Owl', 'Spanner', 'Rain Check', 'Pothole Pete', 'Flip Flop', 'Gravel Rash', 'Beer Hunter',
  'Sunday Best', 'Hot Pepper', 'Moi Moi', 'Overtaker', 'Goat Path', 'Cold Fufu', 'Backmarker', 'Shortcut Susu',
  'Check Mate', 'Dust Devil', 'Sprinkles', 'Wet Socks', 'Biscuit', 'Highway Hannah', 'Roundabout', 'Lekki Lizard',
  'Fanta Pants', 'Bottle Opener', 'Mosquito Magnet', 'Detour', 'Almost Heaven', 'Lost Property', 'Sweet Crude',
  'Flour Power', 'Tin Roof', 'Third Check', 'Half Pint', 'Slippery Slope',
];

export const BIOS = [
  'Ran my first hash in a borrowed pair of shoes and never gave them back.',
  'Occasional hare, constant complainer about the hills.',
  'Here for the Circle, staying for the trail.',
  'Walker by day, front runner on the beer check.',
  'Visiting from out of town and told to bring snacks.',
  'Shiggy is a state of mind.',
  'I have been lost on every trail I ever haired.',
  'Hash Cash is a love language.',
  'If the trail goes up, I am already behind.',
  null, null, null, null,
];

const PLACES = ['Lake', 'Hill', 'Market', 'Creek', 'Estate', 'Beach', 'Forest', 'Ridge', 'Campus', 'Stadium', 'Bridge', 'Quarry', 'Farm', 'Harbour', 'Reserve', 'Park', 'Junction', 'Quay'];
const SHAPES = ['Loop', 'Ramble', 'Crawl', 'Scramble', 'Shiggy', 'Sprint', 'Wander', 'Trot', 'Dash', 'Trek'];

export function runTitle(city: string, n: number, rnd: () => number) {
  const place = PLACES[Math.floor(rnd() * PLACES.length)];
  const shape = SHAPES[Math.floor(rnd() * SHAPES.length)];
  const lead = rnd() < 0.5 ? city : '';
  return `${lead ? lead + ' ' : ''}${place} ${shape}${n % 7 === 0 ? ' II' : ''}`.trim();
}

export const RUN_BLURBS = [
  'Dead hare trail with two false trails, a regroup under the big tree and a beer check the hares refuse to describe.',
  'A flat and friendly trail for a change. Walkers and runners both get a proper circle.',
  'Hills first, apologies later. Bring a torch if you plan to finish after dark.',
  'The hares have been seen scouting with a suspicious amount of chalk.',
  'Expect shiggy. Wear shoes you are willing to say goodbye to.',
  'Visitors and virgins very welcome. Somebody will walk you round.',
  'Short trail, long circle. Songs from the new songbook will be tested.',
  'Starts at the car park, ends wherever the beer is.',
  'Back-to-back checks in the first kilometre. Do not trust the front runners.',
  'Long trail for the keen, a shortcut for the wise.',
];

export const THEMES = ['Bring a torch', 'Wear something yellow', 'Hawaiian shirt trail', 'Sunrise run', 'Full moon shiggy', 'Red dress warm-up', 'Charity run for the school', 'Interhash rehearsal'];

export const WEATHER = [
  { summary: 'Clear and warm', tempC: 29 },
  { summary: 'Overcast, humid', tempC: 27 },
  { summary: 'Light rain at the start', tempC: 25 },
  { summary: 'Hot and dry', tempC: 33 },
  { summary: 'Cool evening breeze', tempC: 24 },
];

export const SONGS = [
  "Here's to Generator", 'Swing Low', 'The Hash House Harrier', 'Show Me the Way to Go Home', 'Roll Me Over', 'The Man Who Never Returned',
  'Oh Mama Put', 'Jollof Anthem', 'Wrong Way Wale', 'Down Down Baby', 'On On the Road to Lagos', 'Beer Check Blues',
];

export const AWARD_TITLES = [
  { title: 'Down-down', reason: 'Called On On the wrong way at the second check', isDownDown: true },
  { title: 'Down-down', reason: 'Wore brand new white shoes to a shiggy trail', isDownDown: true },
  { title: 'Down-down', reason: 'Arrived at the beer check before the beer', isDownDown: true },
  { title: 'Down-down', reason: 'Got lost on a trail with chalk every ten metres', isDownDown: true },
  { title: 'Hare of the Day', reason: 'A trail the whole pack finished smiling', isDownDown: false },
  { title: 'First Hash', reason: 'Finished their first trail', isDownDown: false },
  { title: 'Visitor of the Day', reason: 'Travelled furthest to be here', isDownDown: false },
  { title: 'Shiggy Award', reason: 'Most mud per square centimetre', isDownDown: false },
  { title: 'Iron Stomach', reason: 'Finished every beer stop without complaint', isDownDown: false },
];

export const STORY_BITS: { category: string; body: string }[] = [
  { category: 'TRAIL', body: 'The first false trail caught nearly the whole front pack. The walkers were already at the check, grinning.' },
  { category: 'TRAIL', body: 'A long climb at the halfway mark had everyone bargaining with their lungs.' },
  { category: 'BEER_CHECK', body: 'The beer check was hidden behind a church. The congregation was kind about it.' },
  { category: 'BEER_CHECK', body: 'Two crates, one cooler and a heroic amount of ice. Arrived to cheers.' },
  { category: 'CIRCLE', body: 'The Circle ran long, mostly because of a very detailed explanation of what happened at the second check.' },
  { category: 'VISITOR', body: 'A visitor from out of town joined for the first time and was given a hash name by popular demand.' },
  { category: 'AWARD', body: 'An award was given for the most creative excuse of the evening.' },
  { category: 'SONG', body: 'A new song was debuted and was, generously, called a work in progress.' },
  { category: 'INCIDENT', body: 'One shoe was lost to the mud. It was found at the end, smiling.' },
  { category: 'HUMOR', body: 'The hare was caught carrying a map. A down-down was awarded for cowardice.' },
  { category: 'SAFETY', body: 'A marshal stood at the busy road crossing for the whole run. Thank you.' },
  { category: 'GENERAL', body: 'Good turnout, good trail, good beer. The usual.' },
];

const OPENERS = [
  'It was an evening that began the way most do: with someone asking whether the trail was long.',
  'The pack gathered under a sky that could not decide whether to rain.',
  'There is a particular silence when a hare says "it is not that bad". We heard it again this week.',
  'Everything was going to plan, which should have worried us.',
  'A good crowd turned up, including more visitors than we have had in months.',
];
const MIDDLES = [
  'The trail went through every kind of terrain a city can offer: pavement, gravel, shiggy and one remarkable stretch of someone\'s garden.',
  'Two false trails kept the front runners honest, and the walkers, as usual, arrived with the best stories.',
  'The beer check appeared exactly when morale needed it. The hares will deny planning that.',
  'By the third check the pack had split three ways, and all three groups were confident they were right.',
  'The last kilometre was downhill, which is the only reason anybody forgave the first four.',
];
const CLOSERS = [
  'The Circle was loud, the down-downs were deserved, and the songs were mostly in tune. On On.',
  'We finished with a Circle that ran well past dark. Nobody left early. Nobody ever does.',
  'A fine night all round. The hares owe us nothing except the next trail.',
  'Thanks to the hares, the marshals and everyone who carried a spare bottle of water. See you next week.',
];

export function reportBody(rnd: () => number, extras: { hares: string; meeting: string; distanceKm: string; weather: string }) {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  return [
    pick(OPENERS),
    `${extras.hares} laid a ${extras.distanceKm} km trail from ${extras.meeting}. Conditions: ${extras.weather.toLowerCase()}.`,
    pick(MIDDLES),
    pick(MIDDLES),
    pick(CLOSERS),
  ].join('\n\n');
}

export const REVIEW_COMMENTS = [
  { body: 'Can we add the name of the church where the beer check was?', anchor: 'beer check' },
  { body: 'Is "three ways" right? I counted two groups.', anchor: 'three ways' },
  { body: 'Lovely opening. Maybe trim the second paragraph.', anchor: null },
  { body: 'Please check the spelling of the hare\'s name.', anchor: 'laid a' },
];

export const POSTS = [
  'Who is haring Saturday? The suspense is part of the fun.',
  'Just got back from the best trail in months. Legs have filed a complaint.',
  'Reminder: bring water, bring a torch, bring a friend who has never hashed.',
  'Lost one shoe in the shiggy tonight. If you find a size 43, it is probably mine.',
  'First time haring a trail this weekend. Be kind. Or at least be quiet about it.',
  'The beer check was a mirage and I regret nothing.',
  'Thank you to everyone who marshalled the road crossing. Safety first, shiggy second.',
  'Visiting from out of town this week and the welcome was unreal. On On.',
  'New songbook is out. Please do not sing the one about the Grand Master where he can hear.',
  'We lost the hares at the second check. We have since found them. They were at the bar.',
  'Anybody carpooling from the island on Saturday? I have two seats.',
  'Hash Cash reminder: bring small notes. The Hash Cash officer is not a bank.',
  'There is no such thing as a short trail. Only trails you have not run yet.',
  'Full moon run on Friday. Dress code: whatever glows.',
  'Nothing humbles you like the last hill of a trail you called "easy".',
  'To the person who borrowed my torch: it was a good torch. We should talk.',
  'Rain at the start, sunshine at the beer check, and a Circle that went on forever.',
  'Welcome to our new virgins. You did great. We lied about the hills.',
  'Photos from last week are up. Tag yourselves and apologise to the people you tagged.',
  'On On! Back-to-back checks and not one of us trusted the front runners.',
];

export const COMMENTS = [
  'Great trail, thank you hares!',
  'On On!',
  'I was definitely the one who went the wrong way.',
  'This made my week.',
  'Who took the shortcut? Be honest.',
  'See you at the next one.',
  'The beer check was the best part, no contest.',
  'Brilliant write up.',
  'I need to be at the next run. Count me in.',
  'My legs still hurt. Worth it.',
  'Photos are fantastic, send more!',
  'Down-down for the hare, obviously.',
  'Love this. Welcome to the pack!',
  'Can confirm. I was there. It was muddy.',
  'That climb was personal.',
];

export const REPLIES = [
  'Same, my knees are still in the car park.',
  'Fair, but you were also the one who shouted On On.',
  'Agreed. 10/10, would shiggy again.',
  'See you there!',
  'Down-down incoming.',
  'Haha, true.',
];

export const REEL_CAPTIONS = [
  'The moment the pack hit the first false trail.',
  'Beer check reached. Morale restored.',
  'Circle night. Somebody get the song book.',
  'Sunrise trail, who needs sleep.',
  'Shiggy report: severe.',
  'Warm-up before the run, cold beer after.',
  'Welcome to the hash, virgins!',
  'Running home through the estate at dusk.',
];

export const PHOTO_CAPTIONS = [
  'The pack at the start',
  'First check, the great debate',
  'Shiggy crossing',
  'Beer stop',
  'Hares looking suspiciously proud',
  'Regroup on the ridge',
  'Circle time',
  'Down-down in progress',
  'Sunset finish',
  'Walkers arriving first, as always',
  'The long way round',
  'On In!',
];

export const REJECT_REASONS = ['Not at a Hash event', 'Contains a person who asked not to be photographed', 'Duplicate of an earlier upload'];

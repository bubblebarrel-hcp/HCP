// Emoji for the message box (D73): a small, hand-picked set in groups, with the
// ones a hasher reaches for first (the beer, the shoes, the trail) near the top.
// Every entry is a single emoji or a simple pair, so it renders the same on every
// device and counts as one "character" to a person typing.

export interface EmojiGroup {
  id: string;
  label: string;
  // The tab's face.
  icon: string;
  emoji: string[];
}

const split = (s: string) => s.trim().split(/\s+/);

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: 'smileys',
    label: 'Smileys',
    icon: '😀',
    emoji: split(`😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👻 👽 🤖`),
  },
  {
    id: 'gestures',
    label: 'People',
    icon: '👍',
    emoji: split(`👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🦵 🦶 👂 👃 🧠 👀 👁️ 👅 👄 🏃 🏃‍♀️ 🚶 🧍 🕺 💃 🧎 🤸 🏋️ 🚴 🧗 🏊 🧘 🙋 🙆 🙅 🤷 🤦 💁 🙇`),
  },
  {
    id: 'hearts',
    label: 'Hearts',
    icon: '❤️',
    emoji: split(`❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✨ ⭐ 🌟 💫 ⚡ 🔥 💥 💯 ✅ ❌ ❗ ❓ ‼️ ⚠️ 🚫 ♻️ 🎉 🎊 🎈 🏆 🥇 🥈 🥉 🏅`),
  },
  {
    id: 'hash',
    label: 'Hash',
    icon: '🍺',
    emoji: split(`🍺 🍻 🥂 🍷 🥃 🍸 🍹 🍾 🧉 🥤 🧃 ☕ 🍵 🍕 🍔 🌭 🥪 🌮 🌯 🍟 🍗 🍖 🥩 🍳 🥞 🧇 🍞 🥐 🧀 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🍤 🍙 🍚 🍰 🧁 🍩 🍪 🍫 🍬 🍎 🍌 🍇 🍓 🥭 🍍 🥥 🥑 🌽 🥕 🏃 👟 🥾 🧢 🎒 🧭 🗺️ 📍 🧱 🌲 🌳 🌄 🏔️ ⛰️ 🏞️ 🌧️ ☔ 🌦️ 🐕 🦮 🐕‍🦺`),
  },
  {
    id: 'nature',
    label: 'Nature',
    icon: '🌳',
    emoji: split(`🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🕷️ 🐢 🐍 🦎 🐙 🦑 🦐 🦀 🐠 🐟 🐬 🐳 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦛 🦏 🐪 🦒 🦘 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🐐 🦌 🐕 🐈 🐓 🦃 🕊️ 🐇 🐿️ 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🍁 🍂 🍃 🌺 🌻 🌹 🌷 🌼 🌸 💐 🍄`),
  },
  {
    id: 'travel',
    label: 'Places',
    icon: '🚗',
    emoji: split(`🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 🚂 🚆 🚇 ✈️ 🛫 🛬 🚁 ⛵ 🚤 🛶 ⚓ 🚏 🚦 🚧 ⛽ 🏠 🏡 🏢 🏫 🏥 🏪 ⛪ 🕌 🏰 🗼 🗽 ⛲ ⛺ 🌋 🏖️ 🏝️ 🏜️ 🌅 🌆 🌇 🌃 🌉 🌌 🌍 🌎 🌏`),
  },
  {
    id: 'objects',
    label: 'Things',
    icon: '💡',
    emoji: split(`⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🎯 ⛳ 🎣 🎽 🎿 ⛷️ 🏂 🎮 🎲 🎵 🎶 🎤 🎧 🎸 🥁 📱 💻 ⌚ 📷 📸 🎥 📞 🔋 🔦 💡 🔑 🔒 🔓 🔔 📣 📌 📎 ✏️ 📝 📖 📚 📅 ⏰ ⏳ 💰 💳 🎁 🛒 🧰 🔧 🔨 ⚙️ 🧲 💊 🩹 🧴 🧻 🪣`),
  },
];

const RECENT_KEY = 'hcp:emoji-recent';

export function recentEmoji(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji: string) {
  try {
    const next = [emoji, ...recentEmoji().filter((e) => e !== emoji)].slice(0, 24);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage can be off in a private window; recents are a convenience.
  }
}

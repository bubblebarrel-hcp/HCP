// Emoji for the message box (D73): the same hand-picked set as the web (apps/web/lib/emoji.ts).
// In groups, the ones a hasher reaches for first (the beer, the shoes, the trail) near the top.

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


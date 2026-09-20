export const WORDS = [
  "elephant", "guitar", "pizza", "astronaut", "bicycle",
  "rainbow", "castle", "dragon", "umbrella", "kangaroo",
  "lighthouse", "sandwich", "volcano", "penguin", "treasure",
  "butterfly", "spaceship", "octopus", "mountain", "wizard",
  "hamburger", "tornado", "mermaid", "robot", "cactus",
  "firetruck", "jellyfish", "skyscraper", "vampire", "backpack",
  "helicopter", "pineapple", "skeleton", "trampoline", "dolphin",
  "mushroom", "telescope", "zombie", "hotdog", "pyramid",
  "scooter", "alligator", "cupcake", "ninja", "sailboat",
  "avocado", "firefighter", "snowman", "toothbrush", "dinosaur"
];

export function getRandomWords(count = 3): string[] {
  const shuffled = [...WORDS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
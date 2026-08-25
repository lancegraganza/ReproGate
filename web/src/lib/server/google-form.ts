import "server-only";

import type { GeneratedEvidence } from "./gemini-evidence";
import { randomInt } from "node:crypto";

const FORM_RESPONSE_URL =
  process.env.GOOGLE_FORM_RESPONSE_URL ??
  "https://docs.google.com/forms/d/e/1FAIpQLSd2Ck13Ju-TeC_XWN6u37yPw3DTO0Tg5IpPFJNccctvckYgqA/formResponse";

const fields = {
  fullName: process.env.GOOGLE_FORM_FULL_NAME_FIELD ?? "entry.539509873",
  email: process.env.GOOGLE_FORM_EMAIL_FIELD ?? "entry.579604623",
  wallet: process.env.GOOGLE_FORM_WALLET_FIELD ?? "entry.1006726406",
  scale: process.env.GOOGLE_FORM_SCALE_FIELD ?? "entry.499711501",
  feedback: process.env.GOOGLE_FORM_FEEDBACK_FIELD ?? "entry.828139016",
};

const firstNames = [
  "Miguel",
  "Paolo",
  "Gabriel",
  "Rafael",
  "Adrian",
  "Carlo",
  "Nathan",
  "Joshua",
  "Vincent",
  "Marco",
  "Daniel",
  "Enzo",
  "Andre",
  "Nico",
  "Joaquin",
  "Francis",
  "Christian",
  "Angelo",
  "Jerome",
  "Patrick",
  "Anton",
  "Lance",
  "Renzo",
  "Kenneth",
  "Ryan",
  "Aaron",
  "Kevin",
  "Bianca",
  "Camille",
  "Patricia",
  "Nicole",
  "Alyssa",
  "Andrea",
  "Samantha",
  "Clarisse",
  "Danica",
  "Katrina",
  "Mikaela",
  "Trisha",
  "Nadine",
  "Cheska",
  "Janelle",
  "Maxine",
  "Deelmeer John",
  "John Michael",
  "John Paul",
  "Mark Anthony",
  "John Carlo",
  "James Ryan",
  "Joshua Miguel",
  "Karl Vincent",
  "Mary Grace",
  "Mary Anne",
  "Anne Marie",
  "Nicole Mae",
  "Alyssa Marie",
  "Andrea Mae",
  "Rhea",
  "Kyla",
  "Eliana",
  "Mara",
  "Sofia",
  "Kiara",
  "Zia",
  "Liam",
  "Theo",
  "Julian",
  "Elijah",
  "Amara",
  "Ysabel",
];

const surnames = [
  "Dalisay",
  "Madrigal",
  "Quimson",
  "Lacsamana",
  "Sarmiento",
  "Ylagan",
  "Macaraig",
  "Tanjutco",
  "Balingit",
  "Dimapilis",
  "Esguerra",
  "Mapili",
  "Salonga",
  "Villaseñor",
  "Aglipay",
  "Cuyugan",
  "Lazaro",
  "Marasigan",
  "Natividad",
  "Tiongson",
  "Abesamis",
  "Alcantara",
  "Baluyot",
  "Cabral",
  "Dumlao",
  "Fajardo",
  "Gatmaitan",
  "Hilario",
  "Ilagan",
  "Jalandoni",
  "Katigbak",
  "Legaspi",
  "Magsino",
  "Nolasco",
  "Ocampo",
  "Panganiban",
  "Sandejas",
  "Tolentino",
  "Umali",
  "Valmonte",
  "Zamora",
  "Agbayani",
  "Casilag",
  "De Vera",
  "Guinto",
  "Lapid",
  "Manalili",
  "Nepomuceno",
  "Ordoñez",
  "Punzalan",
  "Recto",
  "Sison",
  "Tuazon",
  "Vergara",
  "Almeda",
  "Montemayor",
  "Villareal",
  "Araneta",
  "Benitez",
  "Cojuangco",
  "Estrella",
  "Laurel",
  "Mendiola",
  "Palma",
  "Roxas",
  "Sumulong",
  "Tirona",
  "Viduya",
  "Zialcita",
  "Guevarra",
];

export interface GoogleFormPayload {
  fullName: string;
  email: string;
  wallet: string;
  scale: string;
  feedback: string;
}

export class GoogleFormSubmissionError extends Error {
  constructor(message: string, readonly ambiguous: boolean) {
    super(message);
  }
}

const usernameWords = [
  "akira",
  "astral",
  "aura",
  "comet",
  "ember",
  "hikari",
  "kaze",
  "kitsune",
  "luna",
  "mecha",
  "moonlit",
  "nebula",
  "orion",
  "phantom",
  "pixel",
  "raven",
  "sakura",
  "shinobi",
  "sora",
  "starlight",
  "titan",
  "vega",
  "yokai",
  "yuki",
  "zen",
  "aegis",
  "arcane",
  "atlas",
  "aurora",
  "blaze",
  "bloom",
  "cipher",
  "cloud",
  "cosmic",
  "crimson",
  "dreamer",
  "echo",
  "falcon",
  "frost",
  "galaxy",
  "glimmer",
  "halo",
  "haru",
  "hoshi",
  "jade",
  "kaiju",
  "lotus",
  "manga",
  "meteor",
  "miko",
  "mirage",
  "nightfall",
  "onyx",
  "phoenix",
  "prism",
  "quest",
  "ryu",
  "shadow",
  "skyline",
  "solstice",
  "spark",
  "spirit",
  "storm",
  "sunrise",
  "takumi",
  "valor",
  "wanderer",
  "wave",
  "zephyr",
  "zero",
];

const shortFeedback = [
  "Nice",
  "Good",
  "Wow",
  "Okay",
  "Love it",
  "Very nice",
  "Nice app",
  "So fast",
  "Works well",
  "Good for me",
  "Easy to use",
  "Simple and fast",
  "I like it",
  "Pretty good",
  "Very smooth",
  "Looks clean",
  "All good",
  "Super easy",
  "Useful app",
  "Fast and clear",
  "Nice experience",
  "Smooth experience",
  "Works for me",
  "Easy process",
  "Good job",
  "Clean design",
  "No problem",
  "Really helpful",
  "Simple to follow",
  "Everything works",
  "Very good",
  "Cool app",
  "Feels nice",
  "Quite useful",
  "Really smooth",
  "Fast result",
  "Clear enough",
  "Easy enough",
  "Good experience",
  "I enjoyed it",
  "Looks good",
  "Feels fast",
  "Very helpful",
  "Nice and easy",
  "Quick and simple",
  "Happy with it",
  "No issues",
  "Works smoothly",
  "Easy for beginners",
  "Good overall",
];

const mediumFeedback = [
  "The app is easy and quick to use",
  "Everything worked well on my first try",
  "The steps are simple and easy to follow",
  "It feels smooth and the result is clear",
  "Good app and I had no problem using it",
  "The whole process was fast for me",
  "I like the clean and simple experience",
  "It works nicely even for a new user",
  "The result appeared quickly and looked correct",
  "I understood the process without much trouble",
  "The page was clear and worked as expected",
  "It was easy to complete the required steps",
  "The app responded fast during my whole test",
  "I had a simple and pleasant experience here",
];

const longerFeedback = [
  "The app was simple to understand and everything worked well during my test",
  "I finished the steps quickly because the instructions were clear and easy to follow",
  "The experience felt smooth and I could see the result without any confusion",
  "This is useful for checking issues and the whole process worked fine for me",
  "I liked how the instructions stayed clear while I completed each part of the process",
  "The application worked reliably and made the testing steps easy for me to understand",
];

function cleanUsernamePart(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

function randomItem<T>(items: readonly T[]): T {
  return items[randomInt(items.length)]!;
}

function randomizedEmail(firstName: string, surname: string): string {
  const nameParts = firstName.split(/\s+/).map(cleanUsernamePart).filter(Boolean);
  const first = nameParts[0] ?? "mika";
  const middle = nameParts[1];
  const family = cleanUsernamePart(surname) || "dalisay";
  const word = randomItem(usernameWords);
  const patterns = [
    [first, family],
    [first, middle ?? word],
    [family, first.slice(0, 1)],
    [first, word],
    [word, first],
    [first.slice(0, 1), family],
    [`${first}${middle ?? ""}`, word],
    [family, word],
    [first.slice(0, 4), family.slice(0, 5)],
    [`${first}${family.slice(0, 1)}`, word],
  ];
  const separator = randomItem(["", "", "", ".", "_"] as const);
  let localPart = randomItem(patterns).join(separator);
  if (randomInt(100) < 32) {
    localPart += String(randomInt(2, 100));
  }
  return `${localPart}@gmail.com`;
}

function boundedFeedback(generated: string): string {
  const roll = randomInt(100);
  const clean = generated.replace(/\s+/g, " ").trim();
  const candidate = roll < 78
    ? randomItem(shortFeedback)
    : roll < 95
      ? randomItem(mediumFeedback)
      : randomItem([...longerFeedback, clean || "Good app"]);
  return candidate.split(/\s+/).slice(0, 20).join(" ") || "Good app";
}

export function createGoogleFormPayload(
  wallet: string,
  generated: GeneratedEvidence,
): GoogleFormPayload {
  const firstName = firstNames[randomInt(firstNames.length)] ?? "Mika";
  const surname = surnames[randomInt(surnames.length)] ?? "Dalisay";
  const fullName = `${firstName} ${surname}`;
  return {
    fullName,
    email: randomizedEmail(firstName, surname),
    wallet,
    scale: randomInt(10) < 8 ? "5" : "4",
    feedback: boundedFeedback(generated.googleFeedback),
  };
}

export async function submitGoogleForm(
  payload: GoogleFormPayload,
): Promise<void> {
  const body = new URLSearchParams({
    [fields.fullName]: payload.fullName,
    [fields.email]: payload.email,
    [fields.wallet]: payload.wallet,
    [fields.scale]: payload.scale,
    [fields.feedback]: payload.feedback,
  });
  let response: Response;
  try {
    response = await fetch(FORM_RESPONSE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new GoogleFormSubmissionError(
      `Google Form submission outcome is uncertain: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }
  const location = response.headers.get("location") ?? response.url;
  if (![200, 301, 302, 303].includes(response.status)) {
    throw new GoogleFormSubmissionError(
      `Google Form submission failed (${response.status}).`,
      false,
    );
  }
  if (!location.includes("/formResponse")) {
    throw new GoogleFormSubmissionError(
      `Google Form returned an uncertain redirect (${response.status}).`,
      true,
    );
  }
}

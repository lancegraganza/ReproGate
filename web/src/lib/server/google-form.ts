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
];

export interface GoogleFormPayload {
  fullName: string;
  email: string;
  wallet: string;
  scale: string;
  feedback: string;
}

function boundedFeedback(generated: string): string {
  const clean = generated.replace(/\s+/g, " ").trim();
  const variants = [
    clean,
    `Good app. ${clean}`,
    `Easy to use. ${clean}`,
    `Nice process. ${clean}`,
    `The steps were clear. ${clean}`,
  ];
  const candidate = variants[randomInt(variants.length)] ?? clean;
  return candidate.split(/\s+/).slice(0, 20).join(" ") || "Good app";
}

export function createGoogleFormPayload(
  wallet: string,
  generated: GeneratedEvidence,
): GoogleFormPayload {
  const firstName = firstNames[randomInt(firstNames.length)] ?? "Mika";
  const surname = surnames[randomInt(surnames.length)] ?? "Dalisay";
  const fullName = `${firstName} ${surname}`;
  const year = 2000 + randomInt(7);
  const emailName = `${firstName}.${surname}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9.]/g, "");
  return {
    fullName,
    email: `${emailName}${year}@gmail.com`,
    wallet,
    scale: String(randomInt(1, 6)),
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
  const response = await fetch(FORM_RESPONSE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const location = response.headers.get("location") ?? response.url;
  if (
    ![200, 301, 302, 303].includes(response.status) ||
    !location.includes("/formResponse")
  ) {
    throw new Error(`Google Form submission failed (${response.status}).`);
  }
}

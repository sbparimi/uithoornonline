// Best-effort mapping from a business category (directory) to the closest request category,
// so "Request a quote" on a business opens the request form with a sensible choice.
const MAP: [RegExp, string][] = [
  [/loodgieter|cv|warmtepomp/i, 'Plumber'],
  [/elektric/i, 'Electrician & installation'],
  [/beveilig|alarm/i, 'Security & alarm systems'],
  [/kinderopvang|gastouder/i, 'Childcare'],
  [/zorg|gezondheid|therapie/i, 'Care & health'],
  [/kapper|beauty/i, 'Hair & beauty'],
  [/onderwijs|bijles|workshop/i, 'Lessons & tutoring'],
  [/\bit\b|computer/i, 'Computer & IT help'],
  [/dier/i, 'Pets'],
  [/fotograf/i, 'Photography & video'],
  [/sport|fitness/i, 'Sport & fitness'],
  [/makelaar|vastgoed/i, 'Property services'],
  [/auto/i, 'Automotive'],
  [/evenement/i, 'Events & occasions'],
  [/eten|catering|food/i, 'Food & catering'],
  [/administratie|financ/i, 'Financial & administration'],
  [/juridisch/i, 'Legal advice'],
  [/schoonmaak/i, 'Cleaning & household'],
  [/tuin/i, 'Garden & outdoor'],
  [/transport|verhuiz/i, 'Transport & logistics'],
  [/klus/i, 'Handyman'],
  [/bouw|schilder|stukadoor/i, 'Home improvement & renovation'],
];
export function requestCategoryFor(businessCategory: string): string | undefined {
  return MAP.find(([re]) => re.test(businessCategory))?.[1] ?? 'Professional services';
}

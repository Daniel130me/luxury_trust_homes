/**
 * States, LGAs and neighbourhoods served by the platform (Lagos and Enugu).
 *
 * The complete official LGA lists are included so no lister is ever locked
 * out of their location; every select also offers an "Other…" escape hatch
 * (see the property form) for hyper-local estates not covered here.
 *
 * Area lists are the neighbourhoods commonly used in Lagos/Enugu real-estate
 * listings. Historic pairings used by existing listings (e.g. Gbagada under
 * Lagos Mainland) are preserved so editing an older listing never breaks.
 */

export type StateGeo = {
  name: string;
  lgas: Array<{
    name: string;
    areas: string[];
  }>;
};

/** Sentinel option value for the "Other…" free-text choices. */
export const OTHER_OPTION = "__other__";

export const STATES: StateGeo[] = [
  {
    name: "Lagos",
    lgas: [
      { name: "Agege", areas: ["Orile Agege", "Pen Cinema", "Agege", "Shogunle", "Oke-Koto", "Dopemu", "Ashade", "Oniwaya", "Ijaiye Ojokoro"] },
      { name: "Ajeromi-Ifelodun", areas: ["Ajegunle", "Amukoko", "Layeni", "Tolu", "Awodi-Ora", "Kirikiri"] },
      { name: "Alimosho", areas: ["Ikotun", "Egbe", "Idimu", "Egbeda", "Akowonjo", "Ipaja", "Ayobo", "Igando", "Abaranje", "Shasha", "Iyana Ipaja", "Command"] },
      { name: "Amuwo-Odofin", areas: ["Festac Town", "Mile 2", "Apple Junction", "Amuwo-Odofin", "Oriade", "Satellite Town", "Agboju", "Ijesha-Tedo"] },
      { name: "Apapa", areas: ["Apapa", "Apapa GRA", "Tin Can Island", "Wharf Road", "Creek Road"] },
      { name: "Badagry", areas: ["Badagry Town", "Agbara", "Ibereko", "Mowo", "Oko-Afo", "Seme Border", "Akarakumo"] },
      { name: "Epe", areas: ["Epe Town", "Eredo", "Agbowa", "Ikosi", "Ketu Ereyun", "Ibowon", "Poka"] },
      {
        name: "Eti-Osa",
        areas: [
          "Lekki Phase 1", "Old Ikoyi", "Banana Island", "Victoria Island", "Sangotedo", "Ajah", "Ikate",
          "Oniru", "Chevron", "Osapa London", "Ilaje", "Jakande Lekki", "Elegushi", "Igbo-Efon", "Ogombo",
          "Badore", "Thomas Estate", "Abijo", "Idado",
        ],
      },
      { name: "Ibeju-Lekki", areas: ["Eleko", "Ibeju", "Dangote Road", "Lekki Free Trade Zone", "Epe Road", "Akodo", "Iwerekun", "Debojo", "Okun-Raiye", "Eleranigbe"] },
      { name: "Ifako-Ijaiye", areas: ["Iju", "Fagba", "Obawole", "Kola", "Agbado", "Ojokoro", "Alagbado", "Ijaiye"] },
      { name: "Ikeja", areas: ["Allen Avenue", "GRA Ikeja", "Ojodu", "Berger", "Magodo Phase 1", "Magodo Phase 2", "Alausa", "Opebi", "Adeniyi Jones", "Omole Phase 1", "Omole Phase 2", "Oregun", "Agidingbi", "Ogba", "Computer Village"] },
      { name: "Ikorodu", areas: ["Ikorodu Central", "Igbogbo", "Imota", "Baiyeku", "Ebute", "Agric", "Owode", "Odogunyan", "Gberigbe"] },
      { name: "Kosofe", areas: ["Ogudu", "Ketu", "Mile 12", "Maryland", "Ojota", "Anthony Village", "Mende"] },
      { name: "Lagos Island", areas: ["Ikoyi", "Obalende", "Victoria Island Annex", "Dolphin Estate", "Lagos Island (Brazilian quarters)"] },
      { name: "Lagos Mainland", areas: ["Yaba", "Surulere", "Gbagada", "Bariga", "Onike", "Akoka", "Iwaya", "Oyingbo", "Ebute Metta", "Jibowu", "Alagomeji", "Sabo Yaba"] },
      { name: "Mushin", areas: ["Mushin", "Ojuwoye", "Ilasamaja", "Itire", "Idi-Oro", "Palm Avenue"] },
      { name: "Ojo", areas: ["Iba", "Ojo Town", "Ijanikin", "Okokomaiko", "LASU Axis", "Iba New Site", "Ojo Aladia"] },
      { name: "Oshodi-Isolo", areas: ["Isolo", "Okota", "Ago Palace Way", "Ejigbo", "Oshodi", "Jakande Estate Isolo", "Bucknor", "Ilasa", "Oshodi Apapa Expressway"] },
      { name: "Shomolu", areas: ["Onipanu", "Palmgrove", "Pedro", "Bariga", "Fola Agoro", "Bajulaiye"] },
      { name: "Surulere", areas: ["Adeniran Ogunsanya", "Bode Thomas", "Iponri", "Ojuelegba", "Shitta", "Randle", "Gbaja", "Coker Aguda", "Iganmu", "Costain"] },
    ],
  },
  {
    name: "Enugu",
    lgas: [
      { name: "Aninri", areas: ["Ndeaboh", "Oduma", "Mpu", "Owelli"] },
      { name: "Awgu", areas: ["Awgu Town", "Mgbowo", "Agbogugu", "Ihe", "Ogbaku"] },
      { name: "Enugu East", areas: ["Abakpa Nike", "Emene", "Nike Lake", "Trans Ekulu East", "Ibagwa Nike"] },
      { name: "Enugu North", areas: ["Independence Layout", "New Haven", "GRA Enugu", "Ogui", "Ogui Nike", "Asata", "Trans Ekulu", "Ugwu-Aaron", "Coal City Garden", "Garki"] },
      { name: "Enugu South", areas: ["Achara Layout", "Uwani", "Emerald Estate", "Amechi", "Thinkers Corner", "Ugbodogwu", "Akwuke", "Obeagu"] },
      { name: "Ezeagu", areas: ["Aku", "Ulasi", "Iwollo", "Oghe", "Oyofo"] },
      { name: "Igbo Etiti", areas: ["Ukehe", "Ogbede", "Aku", "Ikolo", "Idume"] },
      { name: "Igbo-Eze North", areas: ["Enugu-Ezike", "Ogrute", "Unadu", "Itchi"] },
      { name: "Igbo-Eze South", areas: ["Ibagwa Aka", "Ibagwa Ani", "Alor Uno"] },
      { name: "Isi-Uzo", areas: ["Eha-Amufu", "Ikem", "Mbu", "Neke"] },
      { name: "Nkanu East", areas: ["Amagunze", "Akpawfu", "Nara", "Owo"] },
      { name: "Nkanu West", areas: ["Agbani", "Obe", "Akpugo", "Ozalla", "Amodu", "Attakwu"] },
      { name: "Nsukka", areas: ["Nsukka Town", "UNN Axis", "Odim Gate", "Opi", "Ede-Oballa", "Obukpa", "Onuiyi Haven", "Lejja"] },
      { name: "Oji River", areas: ["Oji River Town", "Achi", "Ugwuoba", "Inyi"] },
      { name: "Udenu", areas: ["Obollo-Afor", "Obollo-Eke", "Orba", "Imilike"] },
      { name: "Udi", areas: ["Udi Town", "9th Mile Corner", "Ngwo", "Milken Hill", "Eke"] },
      { name: "Uzo-Uwani", areas: ["Umulokpa", "Adani", "Nimbo", "Ejule"] },
    ],
  },
];

/** LGAs for a state (empty array for an unknown state). */
export function lgasFor(state: string): string[] {
  return (STATES.find((s) => s.name === state)?.lgas ?? []).map((l) => l.name);
}

/** Areas for a state + LGA (empty array when unknown). */
export function areasFor(state: string, lga: string): string[] {
  const stateGeo = STATES.find((s) => s.name === state);
  return stateGeo?.lgas.find((l) => l.name === lga)?.areas ?? [];
}

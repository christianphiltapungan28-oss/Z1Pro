/**
 * Business details shown on the legal pages (/privacy, /terms, /cookies,
 * /refunds). Anything still marked TODO must be filled in before launch —
 * the Data Privacy Act requires a reachable contact and address for the
 * personal information controller and its Data Protection Officer.
 */
export const LEGAL = {
  productName: "Z1P.pro",
  companyName: "FlowSmart",
  // TODO: registered business address (as on DTI/SEC registration).
  companyAddress: "[Registered business address]",
  // TODO: DTI business name or SEC registration number. The Internet
  // Transactions Act (RA 11967) requires online merchants to display it.
  businessRegistration: "[DTI/SEC registration no.]",
  // Temporary: switch to an address on the company's own domain
  // (e.g. support@z1p.pro) once email is set up there.
  contactEmail: "zpronathanwrightflowsmart@gmail.com",
  // TODO: name of the designated Data Protection Officer (can be the owner).
  dpoName: "[Data Protection Officer name]",
  dpoEmail: "zpronathanwrightflowsmart@gmail.com",
  governingLaw: "the Republic of the Philippines",
  lastUpdated: "September 24, 2026",
} as const;

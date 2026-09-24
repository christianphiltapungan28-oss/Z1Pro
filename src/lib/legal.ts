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
  // TODO: a monitored inbox for privacy and support requests.
  contactEmail: "[support email]",
  // TODO: name of the designated Data Protection Officer (can be the owner).
  dpoName: "[Data Protection Officer name]",
  // TODO: can be the same inbox as contactEmail.
  dpoEmail: "[privacy email]",
  governingLaw: "the Republic of the Philippines",
  lastUpdated: "September 24, 2026",
} as const;

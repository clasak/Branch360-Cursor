/**
 * Shared option lists for dropdowns across Branch360.
 * Keep these values authoritative for both client + server logic.
 */

const STANDARD_OPTIONS = {
  serviceTypes: [
    "Bioremediation",
    "Green Drains",
    "Wildlife Trapping",
    "TAP Insulation",
    "Bee Removal",
    "Misc.",
    "Bed Bug Conventional",
    "Bed Bug Heat",
    "Bed Bug K9",
    "GPC (Comm)",
    "GPC (Res)",
    "Termite (Res)",
    "Termite (Comm)",
    "Fumigation (Termite)",
    "Fumigation (Commodity)",
    "Roach Cleanout",
    "Exclusion",
    "Mass Trapping (Rodent)",
    "Rodent Control",
    "Mosquito (Bucket)",
    "Mosquito (Barrier)",
    "Bird",
    "Bat",
    "Genie Max (Odor Control)",
    "Vegetation Management"
  ],
  leadTypes: ["Inbound", "Creative", "TAP"],
  jobTypes: ["Contract", "Job Work"]
};

/**
 * Get a deep copy of the standard option payload so callers can mutate safely.
 * @return {Object}
 */
function getStandardOptions() {
  return JSON.parse(JSON.stringify(STANDARD_OPTIONS));
}

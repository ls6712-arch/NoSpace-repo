/**
 * Kept so code written against the room before it became an engine still finds this at its old path
 * (the page backdrop patch, built on main at 675fdc2, imports it from here). The code lives in ./characters/rig.
 * New code should import from there; this file goes once nothing imports it.
 */
export * from "./characters/rig";

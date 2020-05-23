/**
 * @typedef AMDModule
 * @property {string} name
 * @property {string[]} depNames
 * @property {(...args: any[]) => void} resolveFn
 * @property {object} export
 * @property {boolean} resolved
 */
/** @type {Object<string, AMDModule>} */
const amdModuleMap = {};

/**
 * @param {string} name 
 * @param {string[]} depNames 
 * @param {(...args: any[]) => void} resolveFn 
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function define(name, depNames, resolveFn) {
  amdModuleMap[name] = {name, depNames, resolveFn, export: {}, resolved: false};
}

/**
 * @param {string} name 
 * @param {string[]} [depStack] 
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function require(name, depStack = []) {
  const amdModule = amdModuleMap[name];
  if (!amdModule) throw new Error(`AMD module '${name}' does not exist.`);
  
  if (amdModule.resolved || depStack.includes(name)) {
    return amdModule.export;
  }
  
  depStack = depStack.concat([name]);
  const deps = amdModule.depNames.slice(2).map(depName => require(depName));
  amdModule.resolveFn(require, amdModule.export, ...deps);
  amdModule.resolved = true;
  return amdModule.export;
}
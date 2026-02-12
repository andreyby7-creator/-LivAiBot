// Пустой модуль для замены серверных модулей в клиентском коде
export const calculateRiskScore = () => ({ score: 0, factors: [] });
export const calculateRiskScoreFromJson = () => ({ score: 0, factors: [] });
export const calculateRiskScoreWithAsyncFactors = () => Promise.resolve({ score: 0, factors: [] });
export const calculateRiskScoreWithAsyncFactorsAndCache = () =>
  Promise.resolve({ score: 0, factors: [] });
export const calculateRiskScoreWithCache = () => ({ score: 0, factors: [] });
export const calculateRiskScoreWithFactors = () => ({ score: 0, factors: [] });
export const clearAsyncScoreCache = () => {};
export const clearScoreCache = () => {};
export const createFactorConfigFromJson = () => ({});
export const createFactorConfigsFromJson = () => [];
export const DefaultRiskWeights = {};
export const defaultRiskWeights = {};
export const factorCalculatorRegistryExport = {};
export const getAsyncScoreCacheSize = () => 0;
export const getCustomFactorPlugin = () => null;
export const getScoreCacheSize = () => 0;
export const isAsyncFactor = () => false;
export const isSyncFactor = () => false;
export const registerCustomFactorPlugin = () => {};
export const scoringFactorConfigs = [];

/** Every scenario file in ./scenarios, by name (the file name without .json). */
import type { ScenarioDef } from './scenarios';

const files = import.meta.glob<ScenarioDef>('./scenarios/*.json', {
  eager: true,
  import: 'default',
});

export const SCENARIOS: Readonly<Record<string, ScenarioDef>> = Object.fromEntries(
  Object.entries(files)
    .map(([path, def]) => {
      const name = path.replace(/^.*\//, '').replace(/\.json$/, '');
      return [name, { ...def, name }] as const;
    })
    .sort(([a], [b]) => a.localeCompare(b)),
);

export const scenarioNames = (): string[] => Object.keys(SCENARIOS);

import { useSyncExternalStore } from 'react';
import { getUnits, subscribeUnits, type UnitPrefs } from './units';
import { getDisplay, subscribeDisplay, type DisplaySettings } from './displaySettings';
export const useUnits = (): UnitPrefs => useSyncExternalStore(subscribeUnits, getUnits, getUnits);
export const useDisplay = (): DisplaySettings => useSyncExternalStore(subscribeDisplay, getDisplay, getDisplay);

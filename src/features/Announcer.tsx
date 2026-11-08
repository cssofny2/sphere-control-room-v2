import { useLab } from '../state/labStores';

/**
 * Screen-reader announcements that never move focus: new alarms are read out assertively, and each recorded measurement
 * politely. Visually hidden. Only changes are spoken, so the 20-per-second simulation does not flood a reader.
 */
export function Announcer() {
  const alarm = useLab(s => (s.alarms as Array<{ id: string; text: string; severity?: string; acknowledged?: boolean }>)[0]);
  const latest = useLab(s => (s.experiment.records as Array<{ id: string; resonance: number; uncertaintyHz?: number; fit?: { ok: boolean } }>)[0]);
  const count = useLab(s => (s.experiment.records as unknown[]).length);
  return (
    <>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {alarm && !alarm.acknowledged ? `${alarm.severity === 'critical' ? 'Critical alarm' : 'Alarm'}: ${alarm.text}` : ''}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {latest ? (latest.fit?.ok === false ? `Measurement ${count} recorded, resonance fit failed.` : `Measurement ${count} recorded: ${latest.resonance.toFixed(2)} hertz${typeof latest.uncertaintyHz === 'number' ? `, plus or minus ${latest.uncertaintyHz.toFixed(2)}` : ''}.`) : ''}
      </div>
    </>
  );
}

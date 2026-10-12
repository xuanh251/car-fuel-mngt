import dayjs, { type Dayjs } from 'dayjs';

const API_DATE_FORMAT = 'YYYY-MM-DD';

// Formats with the local calendar date. toISOString would shift it by the UTC offset.
export const toApiDate = (d?: Dayjs | null): string => (d ? d.format(API_DATE_FORMAT) : '');

// Parses YYYY-MM-DD as a local date, the same way toApiDate reads it back.
export const fromApiDate = (s: string): Dayjs | null => (s ? dayjs(s) : null);

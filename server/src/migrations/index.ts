import type { Migration } from './types';
import { migration001AddMobileKey } from './001-add-mobileKey';
import { migration002AddAvatar } from './002-add-avatar';

export const migrations = [migration001AddMobileKey, migration002AddAvatar];


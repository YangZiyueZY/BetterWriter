import type { Migration } from './types';
import { migration001AddMobileKey } from './001-add-mobileKey';
import { migration002AddAvatar } from './002-add-avatar';
import { migration003AddTokenVersion } from './003-add-tokenVersion';
import { migration004AddUserStatusLogin } from './004-add-user-status-login';
import { migration005CreateAdminAudit } from './005-create-admin-audit';
import { migration006CreateDeviceSessions } from './006-create-device-sessions';
import { migration007CreateSecurityAlerts } from './007-create-security-alerts';
import { migration008CreateDeviceAudits } from './008-create-device-audits';

export const migrations = [
  migration001AddMobileKey,
  migration002AddAvatar,
  migration003AddTokenVersion,
  migration004AddUserStatusLogin,
  migration005CreateAdminAudit,
  migration006CreateDeviceSessions,
  migration007CreateSecurityAlerts,
  migration008CreateDeviceAudits,
];

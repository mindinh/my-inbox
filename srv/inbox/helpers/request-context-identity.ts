import { InboxIdentity } from '../../types';
import { AppRequestContext } from '../../core/context/app-request-context';
import {
    assertSapUserFromExecutionContext,
    SAPExecutionContext,
    toInboxIdentity,
} from '../../core/context/sap-execution-context';

export function resolveIdentityFromContexts(
    appContext: AppRequestContext,
    sapContext: SAPExecutionContext
): InboxIdentity {
    return toInboxIdentity(appContext, sapContext);
}

export function assertSapUserForExecutionContext(sapContext: SAPExecutionContext): void {
    assertSapUserFromExecutionContext(sapContext);
}

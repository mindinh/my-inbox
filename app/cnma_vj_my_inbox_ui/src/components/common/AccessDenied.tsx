import { ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AccessDeniedProps {
    className?: string;
}

/**
 * Full-page Access Denied component.
 * Shown when the user's API call returns 403 Forbidden.
 */
export function AccessDenied({ className = '' }: AccessDeniedProps) {
    const { t } = useTranslation();
    return (
        <div className={`flex flex-col items-center justify-center min-h-[60vh] gap-4 ${className}`}>
            <div className="rounded-full bg-destructive/10 p-5">
                <ShieldX className="w-14 h-14 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{t('auth.accessDenied', 'Access Denied')}</h2>
            <p className="text-muted-foreground text-center max-w-md leading-relaxed">
                {t('auth.accessDeniedMessage', 'You do not have permission to access this page. Please contact your administrator.')}
            </p>
        </div>
    );
}

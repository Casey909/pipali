// Auth error message component for chat thread display

import { useTranslation } from 'react-i18next';
import { LogIn, X } from 'lucide-react';

interface AuthErrorMessageProps {
    onSignIn: () => void;
    onDismiss?: () => void;
}

export function AuthErrorMessage({ onSignIn, onDismiss }: AuthErrorMessageProps) {
    const { t } = useTranslation();

    return (
        <div className="billing-message">
            <div className="billing-message-header">
                <span className="billing-message-icon">
                    <LogIn size={18} />
                </span>
                <span className="billing-message-title">
                    {t('authError.sessionExpired.title')}
                </span>
                {onDismiss && (
                    <button className="billing-message-dismiss" onClick={onDismiss} title={t('common.dismiss')}>
                        <X size={16} />
                    </button>
                )}
            </div>
            <p className="billing-message-text">
                {t('authError.sessionExpired.message')}
            </p>
            <div className="billing-message-actions">
                <button className="billing-message-action" onClick={onSignIn} type="button">
                    <LogIn size={14} />
                    {t('authError.sessionExpired.action')}
                </button>
            </div>
        </div>
    );
}

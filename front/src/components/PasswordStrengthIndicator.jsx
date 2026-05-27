import { useMemo } from "react";
import { Check, X } from "lucide-react";
import {
  checkPasswordStrength,
  getPasswordStrengthColor,
  passwordRequirements,
} from "../utils/validation";

const PasswordStrengthIndicator = ({ password, showRequirements = true }) => {
  const strength = useMemo(() => checkPasswordStrength(password), [password]);

  if (!password && !showRequirements) return null;

  return (
    <div className="mt-3 space-y-2">
      {/* Strength Bar */}
      {password && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              Password Strength
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: getPasswordStrengthColor(strength.strength) }}
            >
              {strength.message}
            </span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${(strength.score / 5) * 100}%`,
                backgroundColor: getPasswordStrengthColor(strength.strength),
              }}
            />
          </div>
        </div>
      )}

      {/* Requirements List */}
      {showRequirements && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-600">Requirements:</p>
          {passwordRequirements.map((req) => {
            const isMet = strength.requirements[req.key];
            return (
              <div key={req.key} className="flex items-start gap-2">
                {isMet ? (
                  <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-300 mt-0.5 flex-shrink-0" />
                )}
                <span
                  className={`text-xs ${
                    isMet ? "text-green-600" : "text-slate-500"
                  }`}
                >
                  {req.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;

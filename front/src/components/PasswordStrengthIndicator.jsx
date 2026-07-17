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
            <span
              className="text-xs font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Password strength
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: getPasswordStrengthColor(strength.strength) }}
            >
              {strength.message}
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--color-surface-sunken)" }}
          >
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
          <p
            className="text-xs font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Requirements:
          </p>
          {passwordRequirements.map((req) => {
            const isMet = strength.requirements[req.key];
            return (
              <div key={req.key} className="flex items-start gap-2">
                {isMet ? (
                  <Check
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: "var(--color-success)" }}
                  />
                ) : (
                  <X
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                )}
                <span
                  className="text-xs"
                  style={{
                    color: isMet
                      ? "var(--color-success)"
                      : "var(--color-text-secondary)",
                  }}
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

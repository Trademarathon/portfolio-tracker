import type { PlaybookLevelAlert } from "@/lib/api/alerts";
import type { InvalidCondition, KeyLevel, PerpPlan, RuleEnforcementMode, SpotPlan } from "@/lib/api/session";

type PlanLike = SpotPlan | PerpPlan;

export interface RuleEngineInput {
    plan: PlanLike;
    alert: PlaybookLevelAlert;
    currentPrice: number;
    exchange?: string;
}

export interface RuleEngineResult {
    pass: boolean;
    blockedReasons: string[];
    warnings: string[];
    mode: RuleEnforcementMode;
}

function resolveMode(plan: PlanLike): RuleEnforcementMode {
    return plan.ruleEnforcement?.mode || 'critical';
}

function toNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function thresholdFromLevel(level: number): number {
    return Math.max(Math.abs(level) * 0.001, 1e-8);
}

function getLevelValue(plan: PlanLike, levelType: PlaybookLevelAlert['levelType'], fallbackLevel: number): number | null {
    if (levelType === 'target' || levelType === 'stop') return toNumber(fallbackLevel);
    if (levelType === 'entry_low') {
        return toNumber(plan.entryZone?.low ?? fallbackLevel);
    }
    if (levelType === 'entry_high') {
        return toNumber(plan.entryZone?.high ?? fallbackLevel);
    }
    return toNumber(plan.keyLevels?.[levelType as KeyLevel] ?? fallbackLevel);
}

function isPerpPlan(plan: PlanLike): plan is PerpPlan {
    return 'leverage' in plan || 'touchTwoRequired' in plan || 'liquidityGate' in plan;
}

function evaluateValidWhile(validWhile: any, price: number, levelValue: number): boolean {
    const condition = String(validWhile?.condition || '').toLowerCase();
    const epsilon = thresholdFromLevel(levelValue);
    if (condition === 'above') return price > levelValue + epsilon;
    if (condition === 'below') return price < levelValue - epsilon;
    if (condition === 'inside') return Math.abs(price - levelValue) <= epsilon;
    if (condition === 'outside') return Math.abs(price - levelValue) > epsilon;
    return true;
}

function evaluateInvalidCondition(condition: InvalidCondition, price: number, levelValue: number): boolean {
    const action = String(condition.action || '').toLowerCase();
    const epsilon = thresholdFromLevel(levelValue);

    if (action === 'lose' || action === 'break' || action === 'accept_below') {
        return price < levelValue - epsilon;
    }
    if (action === 'accept_above') {
        return price > levelValue + epsilon;
    }
    if (action === 'back_inside' || action === 'reject') {
        return Math.abs(price - levelValue) <= epsilon;
    }
    return false;
}

export function evaluatePlanRules(input: RuleEngineInput): RuleEngineResult {
    const mode = resolveMode(input.plan);
    const blockedReasons: string[] = [];
    const warnings: string[] = [];

    const addFailure = (message: string, critical = true) => {
        if (mode === 'advisory') {
            warnings.push(message);
            return;
        }
        if (critical || mode === 'all') {
            blockedReasons.push(message);
            return;
        }
        warnings.push(message);
    };

    const alertLevelValue = toNumber(input.alert.levelValue);
    if (alertLevelValue == null) {
        addFailure('Alert level value is missing.', true);
        return {
            pass: blockedReasons.length === 0,
            blockedReasons,
            warnings,
            mode,
        };
    }

    const planLevelValue = getLevelValue(input.plan, input.alert.levelType, alertLevelValue);
    if (planLevelValue == null) {
        addFailure(`Plan level ${input.alert.levelType} is missing.`, false);
    }

    const validWhile = (input.plan as any).validWhile;
    if (validWhile?.level) {
        const validLevelValue = toNumber(input.plan.keyLevels?.[validWhile.level as KeyLevel]);
        if (validLevelValue == null) {
            addFailure(`validWhile level ${validWhile.level} is not configured on the plan.`, false);
        } else if (!evaluateValidWhile(validWhile, input.currentPrice, validLevelValue)) {
            addFailure(`validWhile violated (${validWhile.condition} ${validWhile.level}).`, true);
        }
    }

    if (Array.isArray(input.plan.invalidConditions)) {
        input.plan.invalidConditions.forEach((cond) => {
            if (!cond?.level) {
                addFailure(`Invalid condition ${cond.action} has no level configured.`, false);
                return;
            }
            const invalidLevelValue = toNumber(input.plan.keyLevels?.[cond.level]);
            if (invalidLevelValue == null) {
                addFailure(`Invalid condition level ${cond.level} is missing on the plan.`, false);
                return;
            }
            if (evaluateInvalidCondition(cond, input.currentPrice, invalidLevelValue)) {
                addFailure(`Invalid condition triggered: ${cond.action} at ${cond.level}.`, true);
            }
        });
    }

    if (isPerpPlan(input.plan)) {
        const checklist = input.plan.handbookChecklist || {};

        if (input.plan.touchTwoRequired && checklist.touchTwoObserved !== true) {
            addFailure('Perp gate failed: Touch 2 confirmation is required.', true);
        }

        const hasLiquidityGate = !!input.plan.liquidityGate?.minDailyTrades || !!input.plan.liquidityGate?.minDailyVolume;
        if (hasLiquidityGate && checklist.liquidityOk !== true) {
            addFailure('Perp gate failed: liquidity gate is not confirmed.', true);
        }

        if (input.plan.liquidityGate?.allowedExchanges?.length) {
            const allowed = new Set(input.plan.liquidityGate.allowedExchanges.map((e) => String(e || '').toLowerCase()));
            const currentExchange = String(input.exchange || '').toLowerCase();
            if (currentExchange && !allowed.has(currentExchange)) {
                addFailure(`Perp gate failed: exchange ${currentExchange} is outside allowed exchanges.`, true);
            } else if (!currentExchange && checklist.exchangeOk !== true) {
                addFailure('Perp gate failed: exchange gate is not confirmed.', true);
            }
        }

        if (checklist.hierarchyOk !== true) {
            addFailure('Perp gate failed: hierarchy gate is not confirmed.', true);
        }
    }

    const pass = blockedReasons.length === 0;
    return {
        pass,
        blockedReasons,
        warnings,
        mode,
    };
}

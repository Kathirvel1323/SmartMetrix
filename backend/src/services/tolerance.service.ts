import mongoose from 'mongoose';
import { ToleranceRule, IToleranceRule } from '../models/tolerance-rule.model';
import { IUser } from '../models/user.model';
import { generateToleranceRuleId } from '../utils/tolerance-rule-id.utils';

export interface CreateToleranceRuleDTO {
  name: string;
  instrumentType: string;
  instrumentCategory: string;
  capacityMin: number;
  capacityMax: number;
  capacityUnit: string;
  toleranceMode: 'ABSOLUTE' | 'PERCENTAGE';
  toleranceValue: number;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date;
}

export interface UpdateToleranceRuleDTO {
  name?: string;
  toleranceMode?: 'ABSOLUTE' | 'PERCENTAGE';
  toleranceValue?: number;
  effectiveFrom?: string | Date;
  effectiveTo?: string | Date;
}

export class ToleranceService {
  /**
   * Validates that no ambiguous overlapping active tolerance rule exists for the same
   * instrument scope, capacity range, unit, and effective date range.
   */
  private async checkRuleOverlap(
    instrumentType: string,
    instrumentCategory: string,
    capacityUnit: string,
    capacityMin: number,
    capacityMax: number,
    effectiveFrom: Date,
    effectiveTo: Date | undefined,
    excludeRuleId?: string
  ): Promise<void> {
    const filter: any = {
      instrumentType: instrumentType.trim(),
      instrumentCategory: instrumentCategory.trim(),
      capacityUnit: capacityUnit.trim(),
      isActive: true
    };
    if (excludeRuleId) {
      filter.ruleId = { $ne: excludeRuleId.trim().toUpperCase() };
    }

    const activeRules = await ToleranceRule.find(filter);

    const newStart = effectiveFrom.getTime();
    const newEnd = effectiveTo ? effectiveTo.getTime() : Infinity;

    for (const rule of activeRules) {
      // Check capacity range overlap:
      // Intervals [minA, maxA] and [minB, maxB] overlap if minA <= maxB and maxA >= minB
      const capacityOverlap = capacityMin <= rule.capacityMax && capacityMax >= rule.capacityMin;

      if (capacityOverlap) {
        const ruleStart = rule.effectiveFrom.getTime();
        const ruleEnd = rule.effectiveTo ? rule.effectiveTo.getTime() : Infinity;

        // Check date range overlap:
        const dateOverlap = newStart <= ruleEnd && newEnd >= ruleStart;

        if (dateOverlap) {
          const err: any = new Error(
            `Ambiguous rule conflict: An active tolerance rule (${rule.ruleId} - '${rule.name}') ` +
            `already covers an overlapping capacity range [${rule.capacityMin}, ${rule.capacityMax} ${rule.capacityUnit}] ` +
            `and effective date range for ${instrumentType}/${instrumentCategory}.`
          );
          err.statusCode = 409;
          throw err;
        }
      }
    }
  }

  /**
   * ADMIN: Create a new tolerance rule.
   */
  async createRule(data: CreateToleranceRuleDTO, caller: IUser): Promise<IToleranceRule> {
    if (caller.role !== 'ADMIN') {
      const err: any = new Error('Access forbidden: Only ADMIN can create tolerance rules');
      err.statusCode = 403;
      throw err;
    }

    const { name, instrumentType, instrumentCategory, capacityMin, capacityMax, capacityUnit,
      toleranceMode, toleranceValue, effectiveFrom, effectiveTo } = data;

    // Validate required fields
    if (!name?.trim()) { throw Object.assign(new Error('name is required'), { statusCode: 400 }); }
    if (!instrumentType?.trim()) { throw Object.assign(new Error('instrumentType is required'), { statusCode: 400 }); }
    if (!instrumentCategory?.trim()) { throw Object.assign(new Error('instrumentCategory is required'), { statusCode: 400 }); }
    if (!capacityUnit?.trim()) { throw Object.assign(new Error('capacityUnit is required'), { statusCode: 400 }); }
    if (!['ABSOLUTE', 'PERCENTAGE'].includes(toleranceMode)) {
      throw Object.assign(new Error('toleranceMode must be ABSOLUTE or PERCENTAGE'), { statusCode: 400 });
    }
    if (typeof toleranceValue !== 'number' || !isFinite(toleranceValue) || toleranceValue < 0) {
      throw Object.assign(new Error('toleranceValue must be a non-negative finite number'), { statusCode: 400 });
    }
    if (typeof capacityMin !== 'number' || typeof capacityMax !== 'number' || capacityMin < 0 || capacityMax <= capacityMin) {
      throw Object.assign(new Error('capacityMin must be >= 0 and capacityMax must be > capacityMin'), { statusCode: 400 });
    }

    const fromDate = new Date(effectiveFrom);
    if (isNaN(fromDate.getTime())) {
      throw Object.assign(new Error('effectiveFrom must be a valid date'), { statusCode: 400 });
    }
    let toDate: Date | undefined;
    if (effectiveTo) {
      toDate = new Date(effectiveTo);
      if (isNaN(toDate.getTime()) || toDate <= fromDate) {
        throw Object.assign(new Error('effectiveTo must be a valid date after effectiveFrom'), { statusCode: 400 });
      }
    }

    // Check for ambiguous overlapping active rules
    await this.checkRuleOverlap(
      instrumentType,
      instrumentCategory,
      capacityUnit,
      capacityMin,
      capacityMax,
      fromDate,
      toDate
    );

    const ruleId = await generateToleranceRuleId();

    const rule = new ToleranceRule({
      ruleId,
      name: name.trim(),
      instrumentType: instrumentType.trim(),
      instrumentCategory: instrumentCategory.trim(),
      capacityMin,
      capacityMax,
      capacityUnit: capacityUnit.trim(),
      toleranceMode,
      toleranceValue,
      effectiveFrom: fromDate,
      effectiveTo: toDate,
      isActive: true,
      version: 1,
      createdBy: caller._id,
      updatedBy: caller._id
    });

    await rule.save();
    return rule;
  }

  /**
   * ADMIN: Update (create new version of) a rule.
   * Deactivates current version and creates a new document with version+1.
   */
  async updateRule(
    ruleId: string,
    data: UpdateToleranceRuleDTO,
    caller: IUser
  ): Promise<IToleranceRule> {
    if (caller.role !== 'ADMIN') {
      const err: any = new Error('Access forbidden: Only ADMIN can update tolerance rules');
      err.statusCode = 403;
      throw err;
    }

    const existing = await ToleranceRule.findOne({ ruleId: ruleId.trim().toUpperCase() });
    if (!existing) {
      throw Object.assign(new Error('Tolerance rule not found'), { statusCode: 404 });
    }
    if (!existing.isActive) {
      throw Object.assign(new Error('Cannot update an inactive tolerance rule'), { statusCode: 400 });
    }

    const fromDate = data.effectiveFrom ? new Date(data.effectiveFrom) : existing.effectiveFrom;
    let toDate: Date | undefined = data.effectiveTo ? new Date(data.effectiveTo) : existing.effectiveTo;

    // Check for ambiguous overlapping active rules excluding the existing rule being updated
    await this.checkRuleOverlap(
      existing.instrumentType,
      existing.instrumentCategory,
      existing.capacityUnit,
      existing.capacityMin,
      existing.capacityMax,
      fromDate,
      toDate,
      existing.ruleId
    );

    // Deactivate current version
    existing.isActive = false;
    existing.updatedBy = caller._id as mongoose.Types.ObjectId;
    await existing.save();

    // Create new version
    const newRuleId = await generateToleranceRuleId();

    const newRule = new ToleranceRule({
      ruleId: newRuleId,
      name: (data.name?.trim()) ?? existing.name,
      instrumentType: existing.instrumentType,
      instrumentCategory: existing.instrumentCategory,
      capacityMin: existing.capacityMin,
      capacityMax: existing.capacityMax,
      capacityUnit: existing.capacityUnit,
      toleranceMode: data.toleranceMode ?? existing.toleranceMode,
      toleranceValue: data.toleranceValue ?? existing.toleranceValue,
      effectiveFrom: fromDate,
      effectiveTo: toDate,
      isActive: true,
      version: existing.version + 1,
      createdBy: caller._id,
      updatedBy: caller._id
    });

    await newRule.save();
    return newRule;
  }

  /**
   * ADMIN: Deactivate a rule without physical deletion.
   */
  async deactivateRule(ruleId: string, caller: IUser): Promise<IToleranceRule> {
    if (caller.role !== 'ADMIN') {
      const err: any = new Error('Access forbidden: Only ADMIN can deactivate tolerance rules');
      err.statusCode = 403;
      throw err;
    }

    const rule = await ToleranceRule.findOne({ ruleId: ruleId.trim().toUpperCase() });
    if (!rule) {
      throw Object.assign(new Error('Tolerance rule not found'), { statusCode: 404 });
    }
    if (!rule.isActive) {
      throw Object.assign(new Error('Tolerance rule is already inactive'), { statusCode: 400 });
    }

    rule.isActive = false;
    rule.updatedBy = caller._id as mongoose.Types.ObjectId;
    await rule.save();
    return rule;
  }

  /**
   * Authenticated: List tolerance rules with optional filters.
   */
  async listRules(
    query: { instrumentType?: string; instrumentCategory?: string; activeOnly?: boolean; page?: number; limit?: number },
    caller: IUser
  ): Promise<{ data: IToleranceRule[]; pagination: any }> {
    if (!caller) {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (query.instrumentType) filter.instrumentType = query.instrumentType.trim();
    if (query.instrumentCategory) filter.instrumentCategory = query.instrumentCategory.trim();
    if (query.activeOnly !== false) filter.isActive = true;

    const [data, total] = await Promise.all([
      ToleranceRule.find(filter).sort({ version: -1, createdAt: -1 }).skip(skip).limit(limit),
      ToleranceRule.countDocuments(filter)
    ]);

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }

  /**
   * Authenticated: Get a single rule by ruleId.
   */
  async getRuleById(ruleId: string, caller: IUser): Promise<IToleranceRule> {
    if (!caller) {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
    }
    const rule = await ToleranceRule.findOne({ ruleId: ruleId.trim().toUpperCase() });
    if (!rule) {
      throw Object.assign(new Error('Tolerance rule not found'), { statusCode: 404 });
    }
    return rule;
  }
}

export const toleranceService = new ToleranceService();

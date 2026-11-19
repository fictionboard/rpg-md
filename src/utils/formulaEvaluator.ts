/**
 * Formula Evaluator - safely evaluates formulas with field references
 *
 * Formulas use @field_id syntax to reference other field values
 * Example: "{@strength + @dexterity}" or "{(@strength - 10) / 2}"
 */

/**
 * Evaluate a formula string with field values from dataset
 *
 * @param formula - The formula string with @field_id references (e.g., "{@str + @dex}")
 * @param data - The dataset data object with field values
 * @returns The evaluated result as a number
 */
export function evaluateFormula(formula: string, data: Record<string, any>): number {
	if (!formula) return 0;

	// Remove curly braces if present
	let expression = formula.trim();
	if (expression.startsWith('{') && expression.endsWith('}')) {
		expression = expression.slice(1, -1).trim();
	}

	// Replace @field_id with actual values
	const fieldPattern = /@(\w+)/g;

	expression = expression.replace(fieldPattern, (_match, fieldId) => {
		const value = data[fieldId];

		// Convert value to number, default to 0 if undefined or non-numeric
		if (value === undefined || value === null) {
			return '0';
		}

		// Handle different value types
		if (typeof value === 'number') {
			return String(value);
		}

		if (typeof value === 'boolean') {
			return value ? '1' : '0';
		}

		if (typeof value === 'string') {
			const num = parseFloat(value);
			return isNaN(num) ? '0' : String(num);
		}

		// Arrays, objects, etc. default to 0
		return '0';
	});

	try {
		// Safe evaluation using Function constructor
		// This is safer than eval() but still needs validation
		const result = Function(`"use strict"; return (${expression})`)();

		// Ensure result is a number
		if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
			return result;
		}

		return 0;
	} catch (error) {
		console.error('Formula evaluation error:', error, 'Formula:', expression);
		return 0;
	}
}

/**
 * Evaluate a formula that returns a boolean (for roll formulas like "{@wisdom}d6>4")
 *
 * @param formula - The formula string
 * @param data - The dataset data object
 * @returns The evaluated result as a boolean
 */
export function evaluateCondition(formula: string, data: Record<string, any>): boolean {
	if (!formula) return false;

	let expression = formula.trim();
	if (expression.startsWith('{') && expression.endsWith('}')) {
		expression = expression.slice(1, -1).trim();
	}

	// Replace @field_id with actual values
	const fieldPattern = /@(\w+)/g;

	expression = expression.replace(fieldPattern, (_match, fieldId) => {
		const value = data[fieldId];
		if (value === undefined || value === null) return '0';
		if (typeof value === 'number') return String(value);
		if (typeof value === 'boolean') return value ? 'true' : 'false';
		if (typeof value === 'string') {
			const num = parseFloat(value);
			return isNaN(num) ? '0' : String(num);
		}
		return '0';
	});

	try {
		const result = Function(`"use strict"; return !!(${expression})`)();
		return !!result;
	} catch (error) {
		console.error('Condition evaluation error:', error, 'Formula:', expression);
		return false;
	}
}

/**
 * Extract field dependencies from a formula
 * Returns array of field IDs referenced in the formula
 *
 * @param formula - The formula string
 * @returns Array of field IDs
 */
export function getFormulaDependencies(formula: string): string[] {
	if (!formula) return [];

	const fieldPattern = /@(\w+)/g;
	const matches = formula.matchAll(fieldPattern);
	const dependencies: string[] = [];

	for (const match of matches) {
		const fieldId = match[1];
		if (fieldId && !dependencies.includes(fieldId)) {
			dependencies.push(fieldId);
		}
	}

	return dependencies;
}

/**
 * Validate that a formula is syntactically correct
 *
 * @param formula - The formula to validate
 * @returns true if valid, false otherwise
 */
export function validateFormula(formula: string): boolean {
	if (!formula) return true; // Empty formula is valid

	try {
		let expression = formula.trim();
		if (expression.startsWith('{') && expression.endsWith('}')) {
			expression = expression.slice(1, -1).trim();
		}

		// Replace field references with dummy values
		const testExpression = expression.replace(/@\w+/g, '1');

		// Try to evaluate with dummy values
		Function(`"use strict"; return (${testExpression})`)();
		return true;
	} catch (error) {
		return false;
	}
}

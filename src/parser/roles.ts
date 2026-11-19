/**
 * Role-gated sections: a heading's `(@narrator @player)` puts `data-roles` on its section
 * (`rehype-sections.ts`), and `filterRoles` removes every section the viewer's role is not
 * named on. Built for in-app help; any document can use it.
 * Not access control: the removed text is still in the source on the device. It hides,
 * it does not protect.
 */
import type { Element, Root } from 'hast';

/**
 * Removes, in place, each gated section `role` is not named on, with everything under it.
 * No role keeps only ungated sections. Returns the same tree.
 */
export function filterRoles(tree: Root, role?: string): Root {
	prune(tree, role);
	return tree;
}

function prune(node: Root | Element, role: string | undefined) {
	node.children = node.children.filter((child) => {
		if (child.type !== 'element') return true;
		const roles = child.properties['data-roles'];
		if (child.tagName === 'section' && typeof roles === 'string' && !(role && roles.split(' ').includes(role))) {
			return false;
		}
		prune(child, role);
		return true;
	}) as typeof node.children;
}

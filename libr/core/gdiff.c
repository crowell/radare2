/* radare - LGPL - Copyright 2010-2012 - nibble<develsec.org> */

#include <stdio.h>
#include <string.h>
#include <r_anal.h>
#include <r_list.h>
#include <r_util.h>
#include <r_core.h>

/* Fingerprint functions and blocs, then diff.
 * If `anal_all` is true, analyse the whole binary before */
R_API int r_core_gdiff(RCore *c, RCore *c2, int anal_all) {
	RCore *cores[2] = {c, c2};
	RAnalFunction *fcn;
	RAnalBlock *bb;
	RListIter *iter, *iter2;
	int i;

	if (!c || !c2)
		return R_FALSE;
	for (i = 0; i < 2; i++) {
		if (anal_all)
			r_core_anal_all (cores[i]);
		/* Fingerprint fcn bbs (functions basic-blocs) */
		r_list_foreach (cores[i]->anal->fcns, iter, fcn) {
			r_list_foreach (fcn->bbs, iter2, bb) {
				r_anal_diff_fingerprint_bb (cores[i]->anal, bb);
			}
		}
		/* Fingerprint fcn */
		r_list_foreach (cores[i]->anal->fcns, iter, fcn) {
			fcn->size = r_anal_diff_fingerprint_fcn (cores[i]->anal, fcn);
		}
	}
	/* Diff functions */
	r_anal_diff_fcn (cores[0]->anal, cores[0]->anal->fcns, cores[1]->anal->fcns);

	return R_TRUE;
}

/* copypasta from radiff2 */
static void diffrow(ut64 addr, const char *name, int maxnamelen, ut64 addr2, const char *name2, const char *match, double dist) {
	if (addr2 == UT64_MAX || name2 == NULL)
		printf ("%*s  0x%"PFMT64x" |%8s  (%f)\n",
			maxnamelen, name, addr, match, dist);
	else printf ("%*s  0x%"PFMT64x" |%8s  (%f) | 0x%"PFMT64x"  %s\n",
                maxnamelen, name, addr, match, dist, addr2, name2);
}

R_API void r_core_diff_show(RCore *c, RCore *c2) {
        const char *match;
        RListIter *iter;
        RAnalFunction *f;
        RList *fcns = r_anal_get_fcns (c->anal);
        int maxnamelen = 0;
        int len;
        r_list_foreach (fcns, iter, f) {
                if (f->name && (len = strlen(f->name)) > maxnamelen)
                        maxnamelen = len;
        }
        fcns = r_anal_get_fcns (c2->anal);
        r_list_foreach (fcns, iter, f) {
                if (f->name && (len = strlen(f->name)) > maxnamelen)
                        maxnamelen = len;
        }
        fcns = r_anal_get_fcns (c->anal);
        r_list_foreach (fcns, iter, f) {
                switch (f->type) {
                case R_ANAL_FCN_TYPE_FCN:
                case R_ANAL_FCN_TYPE_SYM:
                        switch (f->diff->type) {
                        case R_ANAL_DIFF_TYPE_MATCH:
                                match = "MATCH";
                                break;
                        case R_ANAL_DIFF_TYPE_UNMATCH:
                                match = "UNMATCH";
                                break;
                        default:
                                match = "NEW";
                        }
                        diffrow (f->addr, f->name, maxnamelen,
				f->diff->addr, f->diff->name,
				match, f->diff->dist);
                        break;
                }
        }
        fcns = r_anal_get_fcns (c2->anal);
        r_list_foreach (fcns, iter, f) {
                switch (f->type) {
                case R_ANAL_FCN_TYPE_FCN:
                case R_ANAL_FCN_TYPE_SYM:
                        if (f->diff->type == R_ANAL_DIFF_TYPE_NULL)
                                diffrow (f->addr, f->name, maxnamelen,
					f->diff->addr, f->diff->name,
					"NEW", f->diff->dist);
                }
        }
}

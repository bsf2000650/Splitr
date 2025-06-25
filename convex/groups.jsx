import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query } from "./_generated/server";

export const getGroupExpenses = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    const group = await ctx.db.get(groupId);

    if (!group) throw new Error("Group not found");

    if (!group.members.some((m) => m.userId === currentUser._id))
      throw new Error("You are not a member of this group");

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    const settlements = await ctx.db
      .query("settlements")
      .filter((q) => q.eq(q.field("groupId"), groupId))
      .collect();

    //                    member map
    const memberDetails = await Promise.all(
      group.members.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return {
          id: u._id,
          name : u.name,
          imageUrl: u.imageUrl,
          role: m.role,
        }
      })
    );

    const ids = memberDetails.map((m) => m.id);

    // Balance Calculation Setup
    // -------------------------
    // Initialize totals object to track overall balance for each user
    // Format: {userId1: balance1, userId2: balance2, ....}

    const totals = Object.fromEntries(ids.map((id) => [id, 0]));

    // Create a two-dimensional ledger to track who owes whom
    // ledger[A][B] = how much owes B
    // Example for 3 users (user1, user2, user3):
    // ledger = {
        // "user1" : {"user2":0, "user3": 0},
        // "user2" : {"user1":0, "user3": 0},
        // "user3" : {"user1":0, "user2": 0}
    // }

    const ledger = {};

    ids.forEach((a)=>{
      ledger[a] = {};
      ids.forEach((b)=>{
        if(a != b) ledger[a][b] = 0;
      });
    });

    for(const exp of expenses){
      const payer = exp.paidByUserId;

      for(const split of exp.splits){
        if(split.userId === payer || split.paid) continue;

        const debtor = split.userId;
        const amt = split.amount;

        totals[payer] += amt;
        totals[debtor] -= amt;

        ledger[debtor][payer] += amt;
      }
    }

    for(const s of settlements){
      totals[s.paidByUserId] += s.amount;
      totals[s.receivedByUserId] -= s.amount;

      ledger[s.paidByUserId][s.receivedByUserId] -= s.amount;
    }

    const balances = memberDetails.map((m)=>({
      ...m,
      totalBalance: totals[m.id],
      owes: Object.entries(ledger[m.id])
          .filter(([,v]) => v > 0)
          .map(([to,amount]) => ledger[other][m.id]),
          owedBy: ids.filter((other) => ledger[other][m.id] > 0).map((other)=>({ from: other, amount: ledger[other][m.id]})),
    }));

    const userLookupMap = {};

    memberDetails.forEach((member) => {
      userLookupMap[member.id] = member;
    });

    return {
      // Group information
      group:{
        id: group._id,
        name: group.name,
        description: group.description,
      },

      members: memberDetails, 
      expenses,
      settlements,
      balances,
      userLookupMap
    };
  },
});

// Get user balances

import { internal } from "./_generated/api";
import { query } from "./_generated/server";

export const getUserBalances = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    //                     1-to-1 expenses (no groupId)
    // Filter expenses to only include one-on-one expenses (not group expenses)
    // where the current user is either the payer or in the splits

    const expenses = (await ctx.db.query("expenses").collect()).filter(
      (e)=>
        !e.groupId && // 1-to-1 only
        (e.paidByUserId === user._id || e.splits.some((s)=>s.userId === user._id))
    );

    let youOwe = 0; // Total amount user owes others
    let youAreOwed = 0; // Total amount others owe the user
    const balanceByUser = {}; // Detailed breakdown per user // Process each expense to calculate balances

    for(const e of expenses){
      const isPayer = e.paidByUserId === user._id;
      const mySplit = e.splits.find((s)=>s.userId === user._id);

      if(isPayer){
        for(const s of e.splits){
          // Skip user's own split or already paid splits
          if(s.userId === user._id || s.paid)
              continue;

          // Add to amount owed to the user
          youAreOwed += s.amount;

          (balanceByUser[s.userId] ??= {owed: 0, owing:0}). owed += s.amount;
        }
      }else if(mySplit && !mySplit.paid){
        // Someone else paid and user hasn't paid thier split
        youOwe += mySplit.amount;

        // Add to the amount the current user owes to the player
        (balanceByUser[e.paidByUserId] ??= {owed:0, owing:0}).owing += mySplit.amount;
      }
    }

    //                    1-to-1 settlements (no groupId)
    // Get settlements that directly involve the current user
    const settlements = (await ctx.db.query("settlements").collect()).filter(
      (s)=> !s.groupId && (s.paidByUserId === user._id || s.receivedByUserId === user._id)
    );

    for(const s of settlements){
      if(s.paidByUserId === user._id){
        // User paid someone else -> reduces what user owes
        youOwe -= s.amount;
        (balanceByUser[s.receivedByUserId] ??= {owed:0, owing:0}).owing -= s.amount;
      }else{
        // Someone paid the user -> reduces what they owe the user
        youAreOwed -= s.amount;
        (balanceByUser[s.receivedByUserId] ??= {owed:0, owing:0}).owing -= s.amount;

      }
    }

    // buil list for UI
    const youOweList = []; // List of people user owes money to
    const youAreOwedByList = []; // List of people who owe the user

    for(const [uid, {owed, owing}] of Object.entries(balanceByUser)) {
      const net = owed - owing; // Calculate net balance
      if(net === 0) continue; // Skip if balanced

      // Get user details
      const counterPart = await ctx.db.get(uid);
      const base = {
        userId : uid,
        name: counterPart?.name ?? "Unknown",
        imageUrl: counterPart?.imageUrl,
        amount: Math.abs(net),
      };

      net > 0 ? youAreOwedByList.push(base) : youOweList.push(base);

    }

    youOweList.sort((a,b)=> b.amount - a.amount);
    youAreOwedByList.sort((a,b)=>b.amount - a.amount);

    return {
      youOwe, // Total amount user owes
      youAreOwed, // Total amount owed to user
      totalBalance: youAreOwed - youOwe, // Net balance
      oweDetails: {youOwe: youOweList, youAreOwedBy: youAreOwedByList}, // Detailed List
    };
  }
});

export const getTotalSpent = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();

    const expenses = await ctx.db.query("expenses").withIndex("by_date", (q)=>q.gte("date", startOfYear));

    
  }
})
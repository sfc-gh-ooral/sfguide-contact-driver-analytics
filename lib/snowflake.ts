import snowflake from "snowflake-sdk";
import fs from "fs";

snowflake.configure({ logLevel: "ERROR" });

let connection: snowflake.Connection | null = null;
let cachedToken: string | null = null;

function getOAuthToken(): string | null {
  const tokenPath = "/snowflake/session/token";
  try {
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, "utf8");
    }
  } catch {
    // Not in SPCS environment
  }
  return null;
}

function getConfig(): snowflake.ConnectionOptions {
  const base = {
    account: process.env.SNOWFLAKE_ACCOUNT || "",
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
    database: process.env.SNOWFLAKE_DATABASE || "CONTACT_ANALYTICS",
    schema: process.env.SNOWFLAKE_SCHEMA || "ANALYTICS",
    role: process.env.SNOWFLAKE_ROLE || "SYSADMIN",
  };

  const token = getOAuthToken();
  if (token) {
    return {
      ...base,
      host: process.env.SNOWFLAKE_HOST,
      token,
      authenticator: "oauth",
    };
  }

  if (process.env.SNOWFLAKE_PASSWORD) {
    return {
      ...base,
      username: process.env.SNOWFLAKE_USER || "",
      password: process.env.SNOWFLAKE_PASSWORD,
    };
  }

  return {
    ...base,
    username: process.env.SNOWFLAKE_USER || "",
    authenticator: "EXTERNALBROWSER",
  };
}

async function getConnection(): Promise<snowflake.Connection> {
  const token = getOAuthToken();

  if (connection && (!token || token === cachedToken)) {
    return connection;
  }

  if (connection) {
    console.log("OAuth token changed, reconnecting");
    connection.destroy(() => {});
  }

  const config = getConfig();
  console.log(token ? "Connecting with OAuth token" : `Connecting to Snowflake (${config.authenticator || "password"})`);
  const conn = snowflake.createConnection(config);
  
  return new Promise((resolve, reject) => {
    conn.connect((err) => {
      if (err) {
        reject(err);
      } else {
        connection = conn;
        cachedToken = token;
        resolve(conn);
      }
    });
  });
}

function isRetryableError(err: unknown): boolean {
  const error = err as { message?: string; code?: number };
  return !!(
    error.message?.includes("OAuth access token expired") ||
    error.message?.includes("terminated connection") ||
    error.code === 407002
  );
}

export async function query<T>(sql: string, retries = 1): Promise<T[]> {
  if (process.env.USE_MOCK_DATA === "true") {
    console.log("Using mock data (USE_MOCK_DATA=true)");
    return getMockData<T>(sql);
  }

  try {
    const conn = await getConnection();
    return await new Promise<T[]>((resolve, reject) => {
      conn.execute({
        sqlText: sql,
        complete: (err, stmt, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve((rows || []) as T[]);
          }
        },
      });
    });
  } catch (err) {
    console.error("Query error:", (err as Error).message);
    if (retries > 0 && isRetryableError(err)) {
      connection = null;
      return query(sql, retries - 1);
    }
    
    console.log("Falling back to mock data due to connection error");
    return getMockData<T>(sql);
  }
}

const TRANSCRIPT_TEMPLATES = [
  {
    reason: "Account Balance Inquiry",
    sentiment: 0.45,
    transcript: `Agent: Good morning, thank you for calling Customer Service. My name is Rebecca, and I'll be assisting you today. Before we begin, may I have your full name and account number for verification purposes?

Client: Hi Rebecca, this is Margaret Chen. My account number is 4521-889-7763.

Agent: Thank you, Mrs. Chen. For security purposes, can you please verify the last four digits of your Social Security number and your date of birth?

Client: Sure, it's 4582, and my birthday is June 12th, 1958.

Agent: Perfect, thank you for verifying that information. I have your account pulled up now. How may I assist you today?

Client: I'm trying to get a clear picture of my total account balance across all my holdings. I have an IRA and a brokerage account with you, and I want to make sure I understand everything before my meeting with my financial advisor next week.

Agent: Absolutely, I'd be happy to help you with that comprehensive overview. Let me pull up all your accounts. I can see you have a Traditional IRA and an individual brokerage account. Your Traditional IRA currently has a balance of $347,892.54, which includes your equity holdings, bond funds, and a small money market position. Your brokerage account shows a balance of $128,456.78.

Client: That sounds about right. Has there been any significant change in the IRA over the past month? I noticed some market volatility.

Agent: Good question. Looking at your IRA account activity, you experienced approximately a 2.3% gain over the past 30 days. Your diversified portfolio helped buffer some of the volatility we saw in the tech sector. Would you like me to email you a detailed statement showing all transactions and holdings?

Client: Yes, that would be very helpful. Can you send it to my email on file?

Agent: I'll send that right over. You should receive it within the next few minutes. Is there anything else I can help you with today, Mrs. Chen?

Client: No, that covers everything. Thank you for being so thorough, Rebecca.

Agent: You're very welcome. Thank you for being a valued our company client. Have a wonderful day, and best of luck with your advisor meeting next week!`
  },
  {
    reason: "Transfer Request",
    sentiment: 0.52,
    transcript: `Agent: Thank you for calling our company. This is David speaking. How may I assist you today?

Advisor: Hi David, this is Jennifer Martinez from Coastal Wealth Advisors. I'm calling on behalf of one of my clients who wants to initiate an external transfer.

Agent: Good afternoon, Ms. Martinez. I'd be happy to help you with that transfer request. Can you provide me with your advisor ID number and the client's account number?

Advisor: Sure, my advisor ID is JM-84521, and the client's account number is 7789-445-2231.

Agent: Thank you. Let me verify a few details. The account holder is Robert Thompson, correct?

Advisor: Yes, that's correct. He's looking to transfer $75,000 from his brokerage account to an external bank account at First National Bank for a real estate down payment.

Agent: Understood. For a transfer of this amount, we'll need to follow our standard verification process. Has Mr. Thompson submitted the external account verification form?

Advisor: We submitted that last week. The bank account should already be on file and verified.

Agent: Let me check... Yes, I see the external account was verified on January 23rd. The transfer can be processed. Given the amount, this will require a medallion signature guarantee and a letter of authorization signed by Mr. Thompson. Do you have those documents ready?

Advisor: I have the signed LOA here. We can get the medallion guarantee from our local bank today.

Agent: Perfect. You can fax those documents to our secure line at 555-890-1234, or upload them through the advisor portal. Once we receive the completed paperwork, the transfer typically processes within 3-5 business days.

Advisor: That works perfectly with his closing timeline. Is there any way to expedite if needed?

Agent: For urgent situations, we do offer a wire transfer option which processes same-day or next-day, but there is a $25 wire fee. Would Mr. Thompson prefer that option?

Advisor: Let me check with him and get back to you. For now, let's proceed with the standard ACH transfer. Can you confirm the receiving account details?

Agent: The verified external account ends in 4478 at First National Bank, correct?

Advisor: Yes, that's correct.

Agent: Excellent. I'll note this transfer request as pending documents. Once we receive the medallion guarantee and LOA, we'll process immediately. Is there anything else I can assist you with today?

Advisor: No, that covers it. Thanks for your help, David.

Agent: You're welcome, Ms. Martinez. Have a great day, and please don't hesitate to call if you have any questions about the transfer status.`
  },
  {
    reason: "Portfolio Rebalance",
    sentiment: 0.61,
    transcript: `Agent: our company, this is Michael speaking. How can I help you today?

Advisor: Hi Michael, this is Thomas Anderson from Summit Financial Group. I need assistance with a portfolio rebalance for one of my high-net-worth clients.

Agent: Good morning, Mr. Anderson. I'd be happy to assist with the rebalance. Could you provide your advisor credentials and the client's account information?

Advisor: My advisor ID is TA-66234. The client is Elizabeth Warren—account number 3345-778-9901. She has about $1.2 million in her managed account.

Agent: Thank you. I have Mrs. Warren's account pulled up. I can see her current allocation is approximately 72% equities, 23% fixed income, and 5% cash. What changes are you looking to make?

Advisor: We want to reduce equity exposure given the current market conditions and her approaching retirement in two years. I'm proposing we move to 55% equities, 40% fixed income, and 5% cash. We also want to shift some of the equity holdings from growth to dividend-focused funds.

Agent: That's a significant but sensible shift given the retirement timeline. Let me calculate what trades would be needed. To execute this rebalance, we'd be looking at selling approximately $204,000 in equity positions and purchasing fixed income. For the equity reallocation, you mentioned moving toward dividend-focused funds—do you have specific funds in mind?

Advisor: Yes, I want to reduce the position in the Large Cap Growth Fund and increase the Dividend Appreciation Fund. We should also add some international dividend exposure.

Agent: I can help structure that. Looking at the current holdings, I'd recommend selling 800 shares of the Large Cap Growth Fund at current market value around $156,000, and using those proceeds to purchase the Dividend Appreciation Fund and the International Dividend Fund. Does that align with your strategy?

Advisor: That's exactly what I was thinking. What's the timeline for execution?

Agent: I can submit the trade orders today, and they'll execute at tomorrow's closing NAV since these are mutual funds. The fixed income purchases can be staggered over a few days to get better average pricing if you prefer, or executed all at once.

Advisor: Let's stagger the fixed income purchases over three days. Can you document this rebalance recommendation in the client's file?

Agent: Absolutely. I'll note the investment rationale—approaching retirement, risk reduction, shift to income-generating assets. I'll also flag this for your compliance review. Shall I prepare a rebalance summary report for Mrs. Warren's records?

Advisor: Yes, please. Email that to both me and the client.

Agent: Will do. You should receive the summary within 24 hours after the trades settle. Anything else I can help with today?

Advisor: That's everything. Thanks for making this so smooth, Michael.

Agent: My pleasure, Mr. Anderson. Thank you for calling our company.`
  },
  {
    reason: "Fee Question",
    sentiment: 0.28,
    transcript: `Agent: Thank you for calling our company. My name is Sarah. How can I assist you today?

Client: Hi Sarah. I'm calling because I received my quarterly statement and I'm confused about some fees that were charged. Frankly, I'm a bit upset because these seem higher than what I expected.

Agent: I understand your concern about the fees, and I apologize for any confusion. I'd be happy to review your statement with you and explain each charge. May I have your name and account number?

Client: This is Richard Morrison, account number 5567-223-4489.

Agent: Thank you, Mr. Morrison. Let me verify your identity with a few security questions... Perfect. I have your account pulled up. Which specific fees are you concerned about?

Client: There's a $125 quarterly advisory fee and something called a "platform fee" for $45. Last quarter I only saw the advisory fee. What is this platform fee?

Agent: I completely understand why that would be confusing, and I apologize this wasn't communicated more clearly. The platform fee is actually not a new charge—it was previously bundled into your advisory fee. Starting this quarter, we separated it out for transparency purposes so clients can see exactly what they're paying for.

Client: So I'm not actually paying more than before?

Agent: Correct. If you look at your statement from last quarter, your total fees were $170. This quarter, the advisory fee is $125 plus the $45 platform fee, which equals $170—the same amount. We made this change based on client feedback requesting more detailed fee breakdowns.

Client: Oh, I see. That makes more sense. But $170 every quarter still feels like a lot. What exactly am I getting for that?

Agent: That's a fair question, and you should absolutely understand the value you're receiving. The advisory fee covers access to your financial advisor, portfolio management, rebalancing services, and quarterly performance reviews. The platform fee covers account maintenance, online access, statement generation, and customer support—like this call today. Your fee structure is actually quite competitive at 0.85% annually given your account size.

Client: I didn't realize it included all those services. I suppose that's reasonable when you put it that way.

Agent: I'm glad I could clarify that for you, Mr. Morrison. Would you like me to email you a detailed fee schedule document? It breaks down exactly what each fee covers.

Client: Yes, please send that over. And I apologize for being frustrated at the start of the call. I just didn't understand the charges.

Agent: No need to apologize at all—you have every right to question fees on your account. Transparency is important to us. I'll send that fee schedule right away. Is there anything else I can help you with today?

Client: No, I think that covers it. Thank you for explaining everything so patiently.

Agent: It was my pleasure, Mr. Morrison. Thank you for being an our company client. Have a great rest of your day!`
  },
  {
    reason: "Technical Support",
    sentiment: -0.15,
    transcript: `Agent: our company Technical Support, this is Kevin. How can I help you today?

Client: Hi Kevin. I've been trying to log into my account online for the past two hours and keep getting an error message. This is incredibly frustrating because I need to check on a pending transaction.

Agent: I'm very sorry to hear you're experiencing login issues. I understand how frustrating that can be, especially when you need to access your account urgently. Let me help you troubleshoot this right away. Can you tell me your username or the email associated with your account?

Client: The email is jsmith47@email.com. I've tried resetting my password three times already and still can't get in.

Agent: Thank you, Mr. Smith. Let me look up your account. I see you've attempted several password resets. What error message are you seeing when you try to log in?

Client: It says "Account temporarily locked due to multiple failed login attempts. Please contact support."

Agent: I see what happened. When you attempted the password resets, each unsuccessful login triggered our security protocols. Your account was automatically locked as a protective measure. I can unlock it for you right now and walk you through a fresh login.

Client: Finally! Yes, please unlock it.

Agent: Done. I've unlocked your account and cleared all the failed login attempts from the system. Now, I'd like to help you set a new password that will work. Are you at a computer right now?

Client: Yes, I'm at my laptop.

Agent: Great. Please go to our website and click "Forgot Password." Enter your email address... Are you seeing the verification options screen?

Client: Yes, it's asking if I want email or text verification.

Agent: Choose text message—it's faster. You should receive a 6-digit code momentarily.

Client: Got it. The code is 847293.

Agent: Perfect. Enter that code and you should be taken to the password reset screen. Remember, your new password needs to be at least 12 characters with at least one uppercase letter, one number, and one special character.

Client: Okay... I've set a new password. Let me try logging in now... It worked! I'm finally in. Thank you so much, Kevin.

Agent: Wonderful! I'm glad we got that resolved. For future reference, if you ever get locked out again, you can call this support line 24/7 and we can unlock your account immediately. Is there anything else I can help you with while I have you on the line?

Client: No, I can take it from here. I really appreciate your patience in walking me through this.

Agent: Absolutely, Mr. Smith. I apologize again for the inconvenience. Thank you for your patience, and have a great rest of your day.`
  },
  {
    reason: "Distribution Request",
    sentiment: 0.35,
    transcript: `Agent: Good afternoon, thank you for calling our company. My name is Amanda. How may I assist you today?

Client: Hi Amanda. I need to take a distribution from my IRA. I'm 67 years old and this will be my first withdrawal.

Agent: I'd be happy to help you with your IRA distribution, Mrs...?

Client: Patterson. Helen Patterson. My account number is 2234-556-7890.

Agent: Thank you, Mrs. Patterson. Let me verify your identity with a few security questions... Perfect. I can see you have a Traditional IRA with a current balance of $234,567. How much would you like to distribute?

Client: I need $15,000 for some home repairs. Is there anything special I need to know since this is my first distribution?

Agent: Great question. Since you're over 59½, you won't be subject to any early withdrawal penalties. However, the distribution will be subject to ordinary income tax. Would you like us to withhold federal taxes from this distribution?

Client: Yes, I think that would be smart. What's the standard withholding?

Agent: The default federal withholding is 10%, which would be $1,500 on a $15,000 distribution. However, you can choose to have more withheld if you'd like—some clients choose 15% or 20% to avoid owing additional taxes at year-end. Do you have a state where you need withholding as well?

Client: I'm in California. How does that work?

Agent: California requires a minimum 10% state withholding on IRA distributions. So if you take the standard 10% federal and 10% state, you'd receive approximately $12,000 after withholdings. Would you like to proceed with those withholding rates?

Client: Let me think... Yes, let's do 15% federal and the required state withholding. Better to be safe than owe money later.

Agent: Smart thinking. So that would be $2,250 federal withholding and $1,500 state withholding, leaving you with $11,250 net. How would you like to receive the funds?

Client: Can you deposit it directly into my checking account?

Agent: Absolutely. I see you have a verified bank account on file ending in 4521 at Wells Fargo. Is that the account you'd like us to use?

Client: Yes, that's my checking account.

Agent: Perfect. I'll set up the distribution now. The funds will be direct deposited within 3-5 business days. You'll also receive a confirmation letter and a 1099-R tax form at year-end for your records. Is there anything else I can help you with today?

Client: No, that's everything. Thank you for explaining all the tax implications—I didn't realize there were so many considerations.

Agent: You're very welcome. It's important to understand the tax impact of retirement distributions. If you have questions later, especially around tax time, please don't hesitate to call back. Have a wonderful day, Mrs. Patterson!`
  },
  {
    reason: "Beneficiary Update",
    sentiment: 0.42,
    transcript: `Agent: our company, this is Christine speaking. How may I help you today?

Client: Hello Christine. I need to update the beneficiaries on my retirement accounts. I recently got remarried and need to add my new spouse.

Agent: Congratulations on your marriage! I'd be happy to help you update your beneficiary designations. This is an important task that many clients overlook. Can I have your name and account number?

Client: Thank you. I'm William Chen, account 6678-334-1122.

Agent: Thank you, Mr. Chen. Let me verify your identity... Perfect. I can see you have a Traditional IRA and a Roth IRA with us. Would you like to update beneficiaries on both accounts?

Client: Yes, both accounts please. Currently my children are listed as beneficiaries. I want to add my wife as the primary beneficiary and keep my children as contingent beneficiaries.

Agent: Understood. For the primary beneficiary—your wife—I'll need her full legal name, Social Security number, date of birth, and the percentage you'd like her to receive.

Client: Her name is Susan Margaret Chen, Social Security is 555-44-7788, born August 3rd, 1960. She should receive 100% as the primary beneficiary.

Agent: Perfect. And for the contingent beneficiaries—your children—I have their information on file. It shows Jennifer Chen and Michael Chen, each at 50%. Would you like to keep those percentages for the contingent level?

Client: Yes, that's correct. If something happens to Susan, I want the accounts split equally between my children.

Agent: I've documented that. Just to confirm the new structure: Susan Margaret Chen is the primary beneficiary at 100%, and contingent beneficiaries are Jennifer Chen at 50% and Michael Chen at 50%. This will apply to both your Traditional IRA and Roth IRA.

Client: That's exactly right.

Agent: Perfect. I have to mention one important legal point: since Susan is now your spouse and will be listed as beneficiary on over $5,000, she has special rights as a spousal beneficiary. If she inherits these accounts, she can roll them into her own IRA and treat them as her own, which provides more flexibility than a non-spouse beneficiary would have.

Client: Good to know. Is there any paperwork I need to sign?

Agent: For retirement account beneficiary changes, we can process this electronically with your verbal authorization, which you've provided today. However, I'll email you a confirmation document summarizing the new beneficiary designations for your records. You should review it and keep it with your important documents.

Client: That sounds perfect. How long until this is effective?

Agent: The change is effective immediately upon processing, which I'll complete within the next few minutes. You'll receive the confirmation email within 24 hours. Is there anything else I can help you with today, Mr. Chen?

Client: No, that covers it. Thank you for making this so easy, Christine.

Agent: My pleasure! Congratulations again on your marriage. Thank you for choosing our company. Have a wonderful day!`
  },
  {
    reason: "Account Opening",
    sentiment: 0.58,
    transcript: `Agent: Thank you for calling our company New Accounts. My name is Brandon. How can I help you today?

Advisor: Hi Brandon, this is Michelle Torres from Pinnacle Advisory Group. I have a new client who wants to open a brokerage account and roll over an old 401k.

Agent: Great to hear you have a new client, Ms. Torres! I'd be happy to help you get those accounts set up. Let me pull up the new account system. Is this for an individual client or a joint account?

Advisor: Individual account. The client is David Nguyen, age 45, and he has about $180,000 in a 401k from a previous employer that he wants to roll over.

Agent: Perfect. Let me walk through what we'll need. For the individual brokerage account, we'll need the completed Account Application, a copy of his driver's license, and the Investment Advisor Agreement signed. For the 401k rollover, we'll need a copy of his most recent 401k statement and a Rollover Request Form.

Advisor: I have most of that ready. His 401k is with Fidelity. What's the best way to initiate the rollover?

Agent: For Fidelity 401ks, we recommend a direct trustee-to-trustee transfer to avoid any potential tax withholding. Here's the process: we'll establish the IRA first, then send a Transfer Request to Fidelity. They typically process these within 2-3 weeks.

Advisor: Should we liquidate the 401k positions before or after the transfer?

Agent: Good question. I recommend transferring "in kind" whenever possible—meaning we transfer the actual investments rather than cashing out. This avoids any market exposure during the transfer period. Once the assets arrive in the new IRA, you can then reallocate according to your investment strategy. However, if Fidelity has any proprietary funds that can't transfer, those would need to be liquidated first.

Advisor: That makes sense. What about investment minimums for the new accounts?

Agent: For standard brokerage accounts, there's no minimum to open. For managed accounts, the minimum is typically $25,000, but that varies by program. Given your client's $180,000 rollover, he'd qualify for most of our advisory programs if that's the direction you want to go.

Advisor: We're thinking of putting him in our moderate growth model. Can we set up automatic monthly contributions too?

Agent: Absolutely. We can set up systematic investments from his bank account—most advisors do monthly contributions. We'll just need a voided check or bank verification form. The minimum systematic investment is $100 per month.

Advisor: Perfect. What's the timeline to get everything set up?

Agent: Once we receive all the paperwork, the new accounts typically open within 48 hours. The 401k rollover takes a bit longer—usually 10-15 business days once Fidelity processes the transfer request. I'll send you the complete document checklist right now. Is there anything else you need for this new client setup?

Advisor: I think that covers the basics. Can you email me the forms?

Agent: Already sending them to your advisor email on file. You should receive the complete new account package within the next few minutes. Welcome to our company, and congratulations on the new client!

Advisor: Thanks Brandon. Very helpful as always.`
  },
  {
    reason: "Complaint",
    sentiment: -0.65,
    transcript: `Agent: Thank you for calling our company. My name is Patricia. How may I assist you today?

Client: I need to speak with a supervisor. I am extremely unhappy with how my account has been handled.

Agent: I'm sorry to hear you're having a negative experience. I'd be happy to try to help resolve your concerns. Can you tell me what's happened?

Client: Fine. My name is Robert Harris, account 7789-112-4456. I've been trying for three weeks—THREE WEEKS—to get a simple address change processed, and every time I call I'm told it's "in process" but nothing happens!

Agent: Mr. Harris, I sincerely apologize for this delay. That's absolutely unacceptable for what should be a straightforward request. Let me pull up your account and see exactly what's happening.

Client: I've heard "let me check" from four different people now. I moved into my new home on January 5th and I still haven't received a single piece of mail at my new address.

Agent: I can see why you're frustrated, and you have every right to be. Looking at your account notes... I see the address change request was submitted on January 8th. It shows it was put on hold due to a security verification requirement. Unfortunately, it appears no one followed up with you about this.

Client: Security verification? Nobody told me I needed to verify anything!

Agent: That's a communication failure on our part, and I apologize. Because you changed both your address and phone number at the same time, our system flagged it as a potential fraud risk. We should have contacted you immediately to verify, but that didn't happen. I can complete that verification right now and get this resolved today.

Client: Finally! What do you need from me?

Agent: I just need to verify a few things: Can you confirm the last four digits of your Social Security number and the name of the bank where your linked checking account is held?

Client: It's 7234, and my bank is Chase.

Agent: Perfect, that matches our records. I'm going to override the security hold right now and update your address. Your new address is 4521 Maple Drive, Tampa, FL 33609, correct?

Client: Yes, that's right.

Agent: Done. Your address is now updated and effective immediately. All future correspondence will go to your new address. I'm also going to place a note on your account requesting that our mailroom re-send any statements from the past three weeks to your new address. You should receive those within 5-7 business days.

Client: Well... thank you for actually fixing it. But I'm still upset that it took three weeks and five phone calls to get a simple address change done.

Agent: Your frustration is completely justified, Mr. Harris, and I'm documenting this experience in our quality assurance system. This is not the level of service we aim to provide. Is there anything else I can help you with today?

Client: No. Just please make sure this is actually done this time.

Agent: You have my word, Mr. Harris. I'm sending you a confirmation email right now as proof. I'm also providing you with my direct callback line—555-234-5678—if you experience any other issues. Thank you for your patience, and again, I apologize for this experience.`
  },
  {
    reason: "Investment Advice Question",
    sentiment: 0.51,
    transcript: `Agent: our company Advisory Support, this is Daniel speaking. How can I help you today?

Advisor: Hi Daniel, this is Sandra Kim from Evergreen Wealth Management. I have a question about alternative investment options for a client who's interested in diversifying beyond traditional stocks and bonds.

Agent: Good afternoon, Ms. Kim. I'd be happy to discuss alternative investment options. What's your client's investment profile and what alternatives are they considering?

Advisor: The client is a 52-year-old business owner with about $2.5 million in investable assets. Very sophisticated investor, high risk tolerance, and long investment horizon. They're specifically asking about REITs, private equity, and commodities.

Agent: Excellent profile for alternatives. Let me walk through what's available on our platform. For REITs, we offer both publicly traded REITs and non-traded REITs through our alternative investment program. The non-traded REITs typically have minimum investments of $25,000 and require accredited investor status.

Advisor: He definitely qualifies as accredited. What are the due diligence materials available for the non-traded options?

Agent: We have comprehensive due diligence packages for each approved offering. These include the prospectus, subscription documents, third-party research reports, and our internal risk assessment. I can have those sent to you for any specific REITs you're considering. We currently have four non-traded REIT offerings available.

Advisor: Good. What about private equity access?

Agent: For private equity, clients with over $1 million in investable assets can access our interval fund offerings, which provide exposure to private equity strategies with quarterly liquidity windows. For direct PE investments, the minimum is typically $250,000, and those are illiquid investments—usually 7-10 year lockups.

Advisor: The interval fund sounds more appropriate. What about commodities?

Agent: For commodities exposure, we typically recommend commodity ETFs or ETNs for most clients—they provide liquid exposure without the complexity of futures contracts. We have several approved options including broad commodity baskets, precious metals funds, and energy-focused products. For a sophisticated client like yours, we also have managed futures products available through our alternative platform.

Advisor: This is very helpful. Can you send me a comparison of the commodity ETF options and the managed futures products?

Agent: Absolutely. I'll prepare a side-by-side comparison with expense ratios, historical performance, and correlation data. You should receive that within the hour. Would you also like information on how these alternatives might fit into a model portfolio allocation?

Advisor: Yes, that would be useful. We're thinking maybe 15-20% allocation to alternatives.

Agent: That's a reasonable allocation for a client with his profile. I'll include some sample portfolio allocations showing how alternatives can complement a traditional equity/bond portfolio. Is there anything else I can help you with today?

Advisor: That should cover it. Thanks for the thorough overview, Daniel.

Agent: My pleasure, Ms. Kim. I'll have those materials to you shortly. Feel free to call back if you have any questions after reviewing. Have a great afternoon!`
  }
];

function getMockData<T>(sql: string): T[] {
  if (sql.includes("V_TREND_SUMMARY")) {
    const weeks = [];
    const baseCallsPerWeek = 2800;
    for (let i = 12; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i * 7);
      const seasonalFactor = 1 + 0.1 * Math.sin((i / 12) * Math.PI);
      const weeklyVariation = 0.9 + Math.random() * 0.2;
      const totalCalls = Math.floor(baseCallsPerWeek * seasonalFactor * weeklyVariation);
      weeks.push({
        WEEK_START: date.toISOString().split("T")[0],
        TOTAL_CALLS: totalCalls,
        OVERALL_SENTIMENT: 0.45 + Math.random() * 0.20,
        TOTAL_ESCALATIONS: Math.floor(totalCalls * (0.08 + Math.random() * 0.04)),
        ESCALATION_RATE: 8 + Math.random() * 4,
        AVG_CALL_DURATION_SEC: 380 + Math.floor(Math.random() * 80),
      });
    }
    return weeks as T[];
  }

  if (sql.includes("V_CALL_DRIVER_ANALYSIS") || sql.includes("line_of_business")) {
    const lobs = ["Retirement Services", "Investment Products", "Insurance Solutions", "Advisory Services", "Brokerage Operations"];
    const products = ["IRA/401k", "Mutual Funds", "Annuities", "Life Insurance", "Fee-Based Advisory", "Trading/Execution"];
    const segments = ["High Net Worth", "Mass Affluent", "Emerging Affluent", "General"];
    const callerTypes = ["Advisor", "Client", "Branch Staff"];
    
    const data = [];
    for (let i = 0; i < 25; i++) {
      data.push({
        LINE_OF_BUSINESS: lobs[i % lobs.length],
        PRODUCT_CATEGORY: products[Math.floor(Math.random() * products.length)],
        CUSTOMER_SEGMENT: segments[Math.floor(Math.random() * segments.length)],
        CALLER_TYPE: callerTypes[Math.floor(Math.random() * callerTypes.length)],
        CALL_VOLUME: 400 + Math.floor(Math.random() * 600),
        AVG_DURATION: 300 + Math.floor(Math.random() * 300),
        AVG_SENTIMENT: 0.35 + Math.random() * 0.45,
        ESCALATIONS: Math.floor(Math.random() * 50),
        RESOLUTION_RATE: 60 + Math.random() * 30,
      });
    }
    return data.sort((a, b) => (b as { CALL_VOLUME: number }).CALL_VOLUME - (a as { CALL_VOLUME: number }).CALL_VOLUME) as T[];
  }

  if (sql.includes("DISTINCT")) {
    return [{
      LINE_OF_BUSINESS: "Retirement Services",
      PRODUCT_CATEGORY: "IRA/401k",
      CUSTOMER_SEGMENT: "High Net Worth",
    }, {
      LINE_OF_BUSINESS: "Investment Products",
      PRODUCT_CATEGORY: "Mutual Funds",
      CUSTOMER_SEGMENT: "Mass Affluent",
    }, {
      LINE_OF_BUSINESS: "Insurance Solutions",
      PRODUCT_CATEGORY: "Annuities",
      CUSTOMER_SEGMENT: "Emerging Affluent",
    }, {
      LINE_OF_BUSINESS: "Advisory Services",
      PRODUCT_CATEGORY: "Fee-Based Advisory",
      CUSTOMER_SEGMENT: "General",
    }, {
      LINE_OF_BUSINESS: "Brokerage Operations",
      PRODUCT_CATEGORY: "Trading/Execution",
      CUSTOMER_SEGMENT: "High Net Worth",
    }] as T[];
  }

  if (sql.includes("CALL_TRANSCRIPTS") && sql.includes("TRANSCRIPT")) {
    const lobs = ["Retirement Services", "Investment Products", "Insurance Solutions", "Advisory Services", "Brokerage Operations"];
    const segments = ["High Net Worth", "Mass Affluent", "Emerging Affluent", "General"];
    const dispositions = ["Resolved", "Follow-up Required", "Transferred", "Escalated"];
    
    const lobMatch = sql.match(/LINE_OF_BUSINESS\s*=\s*'([^']+)'/);
    const segmentMatch = sql.match(/CUSTOMER_SEGMENT\s*=\s*'([^']+)'/);
    const escalatedMatch = sql.includes("ESCALATED = TRUE");
    const filterLob = lobMatch ? lobMatch[1] : null;
    const filterSegment = segmentMatch ? segmentMatch[1] : null;
    
    const data = [];
    for (let i = 0; i < 100; i++) {
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 90));
      const hours = 8 + Math.floor(Math.random() * 10);
      const mins = Math.floor(Math.random() * 60);
      
      const template = TRANSCRIPT_TEMPLATES[i % TRANSCRIPT_TEMPLATES.length];
      const transcriptIndex = i % TRANSCRIPT_TEMPLATES.length;
      const dateVariation = i * 17;
      
      const baseSentiment = template.sentiment;
      const sentimentVariation = (Math.random() - 0.5) * 0.15;
      const sentiment = Math.max(-1, Math.min(1, baseSentiment + sentimentVariation));
      
      const escalated = sentiment < -0.4 || (template.reason === "Complaint" && Math.random() < 0.7);
      
      const wordCount = template.transcript.split(/\s+/).length;
      const baseSeconds = Math.floor(wordCount * 1.8);
      const durationVariation = Math.floor(Math.random() * 120) - 60;
      const duration = Math.max(180, baseSeconds + durationVariation);
      
      const callLob = lobs[(transcriptIndex + Math.floor(i / TRANSCRIPT_TEMPLATES.length)) % lobs.length];
      const callSegment = segments[Math.floor(i / 4) % segments.length];
      
      data.push({
        CALL_ID: `CALL-${String(10000 + i + dateVariation).padStart(8, '0')}`,
        CALL_DATE: date.toISOString().split("T")[0],
        CALL_TIME: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`,
        DURATION_SECONDS: duration,
        LINE_OF_BUSINESS: callLob,
        CALL_DISPOSITION: escalated ? "Escalated" : dispositions[Math.floor(Math.random() * (dispositions.length - 1))],
        CALL_REASON: template.reason,
        CUSTOMER_SEGMENT: callSegment,
        TRANSCRIPT: template.transcript,
        SENTIMENT_SCORE: sentiment,
        ESCALATED: escalated,
      });
    }
    
    let filteredData = data;
    if (filterLob) {
      filteredData = filteredData.filter(d => d.LINE_OF_BUSINESS === filterLob);
    }
    if (filterSegment) {
      filteredData = filteredData.filter(d => d.CUSTOMER_SEGMENT === filterSegment);
    }
    if (escalatedMatch) {
      filteredData = filteredData.filter(d => d.ESCALATED === true);
    }
    
    return filteredData as T[];
  }

  return [];
}

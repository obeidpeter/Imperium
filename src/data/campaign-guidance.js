// Authored guidance describes existing objectives and earned capabilities.
// It never awards abilities or substitutes for the rules core.
export const CAREER_GUIDANCE = Object.freeze({
  1:{title:'Learn the rhythm of the line',authority:'One soldier',focus:'Move once, act once, then let the field respond. A protected position can be worth more than an early strike.',earned:'You carry the oath and the lead seal into active service.',next:'Assist wounded comrades and bring a broken column home.'},
  2:{title:'Bring someone home',authority:'A comrade in the ranks',focus:'Keep close to the wounded column. The causeway is faster than the marsh; extraction matters more than chasing every enemy.',earned:'Your service earns the trust of a specialist.',next:'Scout hidden threats and recover the records of the legion.'},
  3:{title:'Read the ground',authority:'Trusted specialist',focus:'Scout before committing to the station. Recovering the records and escorting their bearers are different problems.',earned:'The optio’s staff gives you your first direct command.',next:'One order each turn can override a comrade’s announced plan.'},
  4:{title:'Make your first order count',authority:'One command each turn',focus:'You cannot direct everyone yet. Hold the gate with a dependable ally while you cover the withdrawal.',earned:'A century now depends on your judgment.',next:'Three commands each turn; form a line, shield wall or wedge.'},
  5:{title:'Choose the shape of the fight',authority:'Three commands each turn',focus:'Use formations to solve a position: protection at a gate, coordination through marsh, or a concentrated attack. One order never grants a second action.',earned:'You become the senior centurion responsible for the eagle.',next:'Four commands and Rally to restore nearby friends.'},
  6:{title:'Preserve the people and the standard',authority:'Four commands each turn',focus:'Supplies and the wounded company follow you. Rally supports those within three tiles; keep the extraction route open.',earned:'The equestrian appointment places a legion in your keeping.',next:'Prepare the camp, deploy before the clash and speak in council.'},
  7:{title:'Prepare before you command',authority:'Five commands each turn',focus:'Choose a preparation with the battlefield in mind. In council, build support around each delegate’s interests and protect it until the vote.',earned:'You are trusted with an independent expeditionary command.',next:'Negotiate passage, then bring civilians across the river.'},
  8:{title:'The crossing is a promise',authority:'Five commands each turn',focus:'The council settles terms, but it cannot move the families for you. Screen the fords and keep every column near its commander.',earned:'Your expedition earns command of a campaign army.',next:'Six commands and an operational stratagem against heavy cavalry.'},
  9:{title:'Win the ground before the charge',authority:'Six commands each turn',focus:'Compare the night march, feigned retreat and flank march. Use the ground to deny cavalry a clean approach, then secure the city.',earned:'Dux marks your highest military command; provincial office follows.',next:'Allocate six convoys, judge competing claims and defend the grain routes.'},
  10:{title:'A province is more than a treasury',authority:'Military and civil responsibility',focus:'Your allocation helps different districts. Defend both supply routes, then persuade the tribunal to accept your public judgment.',earned:'The governorship becomes your record before the Senate.',next:'Invoke your service record and answer rival speakers in two Senate Contests.'},
  11:{title:'Earn a place in the chamber',authority:'A petition, not an entitlement',focus:'A narrow majority is vulnerable. Protect wavering votes, consider each bloc, and weigh a promise against the debt it carries.',earned:'Your decisive Senate victory earns admission at consular rank.',next:'Secure legitimacy and choose an accession route supported by your career.'},
  12:{title:'Let the whole career answer',authority:'Military, public and Senate backing',focus:'Recognition and the final confrontation are separate challenges. Earlier standing opens routes; even the costly backer requires a victory.',earned:'The army’s acclamation and Senate’s confirmation complete your ascent.',next:'The oath returns. Your decisions and obligations shape the reign.'}
});

export const MISSION_GUIDANCE = Object.freeze({
  training:['Learn by doing','Demonstrate Move, Strike, Brace and Throw. You have time to read every preview.'],
  clear:['Break the field force','Account for announced reinforcements. Protect the commander while concentrating attacks.'],
  extract:['Protect the withdrawal','Help anyone awaiting rescue before leading the column. Keep a protector beside threatened survivors; bring every column and the commander into the rally marker.'],
  hold:['Hold the approach','Keep the marked ground clear of adjacent enemies. A chase can cost control of the objective.'],
  recover:['Recover the records','Scout the hidden threat and reach the chest. Clearing the entire field is not required.'],
  capture:['Secure the positions','Bring a friendly unit beside each marker and clear enemies from its immediate approach.'],
  supply:['Keep the grain moving','Secure both routes while protecting the stores. Raider movement matters as much as their damage.'],
  defection:['Win their allegiance','Rally near rival infantry until three formations pledge. Keep your commander alive.'],
  settlement:['Protect the parley','Bring the envoy to the claimant, support the meeting with Rally and hold it for two turns.'],
  surrender:['Control the approaches','Secure both gates, then bring the commander to the rival standard.']
});

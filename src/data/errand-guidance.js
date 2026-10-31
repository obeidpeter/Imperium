// Presentation only: the first matching step explains what the existing
// dialogue rules allow next. It grants no item, flag, reward or progress.
const step=(text,target,when={})=>Object.freeze({text,target,when:Object.freeze(when)});
const ground=(id,item)=>step(`Collect ${item} from the camp ground in Equipment; make room if needed.`,{panel:"kit"},{groundItem:id});
const missing=item=>step(`Check your pack: ${item} is missing.`,{panel:'kit'});
export const ERRAND_STEPS=Object.freeze({
  drill_first:[step('Return to Varro.', 'ch1:varro',{flag:'post_struck'}),step('Strike the practice post.', 'ch1:post')],
  names_roll:[step('Return the list to Sabinus.', 'ch2:sabinus',{flag:'names_list'}),step('Ask Didius for the list.', 'ch2:capsarius')],
  medicine:[step('Bring the medicine box to Didius.', 'ch2:capsarius',{item:'medicine_box'}),ground('medicine_box','the medicine box'),step('Buy a medicine box from the sutler.', 'ch2:trader')],
  shields:[step('Tell Naso the shields are delivered.', 'ch2:naso',{flag:'shields_delivered'}),step('Carry the shields from the tent lines.', 'ch2:shields')],
  letter:[step('Deliver the letter to Tertius.', 'ch3:clerk',{item:'wax_tablet'}),ground('wax_tablet','the wax tablet'),step('Get a replacement wax tablet from the sutler.', 'ch3:trader')],
  well:[step('Report the well to Didius.', 'ch3:capsarius',{flag:'well_seen'}),step('Inspect the station well.', 'ch3:well')],
  tracks:[step('Report the tracks to Brennus.', 'ch3:brennus',{flag:'tracks_read'}),step('Read the tracks beside the drill field.', 'ch3:tracks')],
  second_copy:[step('Finish the second copy with Tertius.', 'ch3:clerk')],
  gate_braces:[step('Tell Aper the brace is in place.', 'ch4:quartermaster',{flag:'brace_racked'}),step('Set the brace in the gate rack.', 'ch4:brace-rack',{item:'gate_brace'}),ground('gate_brace','the gate brace'),missing('the gate brace')],
  ford_count:[step('Report the raft count to Brennus.', 'ch4:brennus',{flag:'rafts_counted'}),step('Count the rafts from the lookout.', 'ch4:lookout')],
  listening_bowl:[step('Bring the bowl to the engineer.', 'ch5:engineer',{item:'bronze_bowl'}),ground('bronze_bowl','the bronze bowl'),step('Borrow a bowl from the water steward.', 'ch5:water',{notFlag:'bronze_bowl_lent'}),missing('the borrowed bowl')],
  letter_home:[step('Tell your companion the letter is sent.', ['ch5:lucan','ch5:sabinus'],{flag:'company_letter_sent'}),step('Give the letter to the evacuation officer.', 'ch5:evacuation',{item:'company_letter'}),ground('company_letter','the letter home'),missing('the letter home')],
  western_wells:[step('Read the western road marker.', 'ch6:marker',{notFlag:'western_marker_read'}),step('Read the tracks beside the refuge.', 'ch6:caravan',{notFlag:'refuge_tracks_read'}),step('Report the route to Felix.', 'ch6:felix')],
  eagle_cords:[step('Bring the leather to the eagle-bearer.', 'ch6:aquilifer',{item:'leather_thongs'}),ground('leather_thongs','the leather thongs'),step('Buy leather thongs from the water-seller.', 'ch6:trader')],
  boot_sizes:[step('Put the boot sizes to Aper.', 'ch7:quartermaster',{flag:'boot_tally_read'}),step('Read the boot tally against Naso’s list.', 'ch7:boot-tally')],
  theon_order:[step('Explain the order of a speech to Theon.', 'ch7:theon')],
  ford_soundings:[step('Sound the landing with the pole.', 'ch8:sounding-pole',{notFlag:'landing_sounded'}),step('Read the ferrymen’s depth board.', 'ch8:depth-marks',{notFlag:'depth_board_read'}),step('Report the crossing to Felix.', 'ch8:felix')],
  seed_jar:[step('Return to Aelia with the seed jar.', 'ch8:aelia',{item:'seed_jar'}),ground('seed_jar','the seed jar'),step('Collect the seed jar from the stores.', 'ch8:seed-jar',{notFlag:'seed_jar_taken'}),missing('the seed jar')],
  recall_signal:[step('Tell your companion the chosen signal.', ['ch9:lucan','ch9:sabinus'],{any:[{flag:'recall_three'},{flag:'recall_long'},{flag:'recall_rising'}]}),step('Agree a recall signal with the cornicen.', 'ch9:cornicen')],
  market_keys:[step('Report the granary count to the envoy.', 'ch9:envoy',{flag:'granaries_counted'}),step('Read the requisition tally.', 'ch9:requisition-tally')],
  granary_receipts:[step('Read the granary receipts.', 'ch10:granary-receipts',{notFlag:'receipts_read'}),step('Read the seized warehouse tally.', 'ch10:warehouse-tally',{notFlag:'warehouse_read'}),step('Report the missing grain to the provincial clerk.', 'ch10:provincial-clerk')],
  frightened_witness:[step('Tell Theon that Licinia will speak.', 'ch10:theon',{flag:'witness_persuaded'}),step('Reassure Licinia at the tribunal.', 'ch10:witness',{any:[{flag:'aelia_vouched'},{attribute:{elo:14}},{decoration:'corona_civica'}]}),step('Ask Aelia to stand with Licinia.', 'ch10:aelia')],
  station_report:[step('Bring the fair copy to Paullus.', 'ch11:paullus',{item:'report_copy'}),ground('report_copy','the report copy'),step('Copy the station report from the service records.', 'ch11:station-report',{notFlag:'station_report_copied'}),missing('the report copy')],
  province_accounts:[step('Bring the accounts to Crispus.', 'ch11:crispus',{item:'accounts_copy'}),ground('accounts_copy','the accounts copy'),step('Collect the audited accounts.', 'ch11:province-accounts',{notFlag:'province_accounts_taken'}),missing('the accounts copy')],
  seal_shown:[step('Tell Quintus the seal is shown.', 'ch12:quintus',{flag:'seal_held_up'}),step('Show your oath seal at the standards.', 'ch12:standards',{oath:true}),step('Your oath must be sworn before the seal can be shown.',null)],
  spring_seed:[step('Return to Aelia with the seed grain.', 'ch12:aelia',{item:'seed_grain'}),step('Tell Aelia that Aper released the seed.', 'ch12:aelia',{flag:'seed_released'}),ground('seed_grain','the seed grain'),step('Ask Aper to release spare seed grain.', 'ch12:quartermaster',{attribute:{auth:15}}),step('Buy seed grain from the sutler.', 'ch12:trader')]
});
for(const steps of Object.values(ERRAND_STEPS))Object.freeze(steps);

export const categories = [
  ['Diensten','Practical help from local professionals'],['Winkels','Local shops and independent makers'],['Eten & drinken','Restaurants, take-away and cafés'],['Klussen','Find trusted help for your home'],['Werk','Local jobs and opportunities'],['Evenementen','What is happening nearby'],['Aanbiedingen','Local deals and promotions'],['Buurt','Requests, recommendations and community']
] as const;

export const businesses = [
  {name:'Local Services',type:'Diensten',desc:'Find reliable professionals in and around Uithoorn.',tag:'Popular'},
  {name:'Eet & Drink Uithoorn',type:'Eten & drinken',desc:'Discover local food, cafés and take-away.',tag:'Local'},
  {name:'Home & Klus',type:'Klussen',desc:'Local tradespeople for repairs, maintenance and projects.',tag:'Trusted'},
  {name:'Uithoorn Jobs',type:'Werk',desc:'Opportunities from employers close to home.',tag:'New'},
] as const;

export const events = [
  ['Weekendmarkt','Vandaag · Centrum Uithoorn'],['Live aan de Amstel','Zaterdag · Amstelplein'],['Buurtborrel De Kwakel','Zondag · De Kwakel']
] as const;

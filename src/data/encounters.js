// Authored tactical spaces. Dots use the regional ground; X is impassable rock,
// ~ deep river, f ford, # wall, ^ high ground, = road, s stone, m marsh.
const map=(...rows)=>rows;
export const BATTLE_SCENARIOS={
  'ch1-training':{mode:'training',goal:[4,3],map:map('........','........','..^.....','========','........','.....^..','........','........'),enemies:[[2,3,'trainer']]},
  'ch1-road':{mode:'clear',goal:[6,4],map:map('..XX....','....^...','====....','...=====','....^...','..XX....','........','........'),enemies:[[5,2,'raider'],[6,5,'archer']],waves:[{turn:3,x:7,y:5,role:'raider'}]},
  'ch2-marsh':{mode:'extract',goal:[7,5],map:map('mmmmmmmm','mm==mmmm','mm=mm===','===mm=mm','mm====mm','mmmmm===','mmmmmmmm','mmmmmmmm'),enemies:[[6,1,'raider'],[6,6,'infantry']]},
  'ch2-rearguard':{mode:'hold',goal:[2,4],hold:4,map:map('mmmmmmmm','mm=mmXmm','mm=mmXmm','========','mm=mmmmm','mm==mmmm','mmX=mmmm','mmm=mmmm'),enemies:[[5,3,'raider'],[6,6,'archer']],waves:[{turn:3,x:7,y:3,role:'raider'}]},
  'ch3-station':{mode:'recover',goal:[6,1],map:map('..XXX...','.....#s.','..^..#..','====....','..XX....','....^...','........','........'),enemies:[[6,3,'archer'],[4,6,'raider']]},
  'ch3-rolls':{mode:'extract',goal:[7,6],map:map('....X...','...^X...','....X...','====f===','....X...','..^.....','....====','........'),enemies:[[5,1,'archer'],[6,5,'raider']]},
  'ch4-gate':{mode:'hold',goal:[2,3],hold:4,map:map('...#....','...#.^..','...#....','sss=ssss','...#....','...#.^..','...#....','........'),enemies:[[6,2,'infantry'],[6,4,'archer'],[5,6,'raider']],waves:[{turn:3,x:7,y:3,role:'infantry'}]},
  'ch4-wall':{mode:'extract',goal:[7,1],map:map('XXXXXXXX','ssssssss','##..##..','sssss...','..##....','........','...^....','........'),enemies:[[5,1,'guard'],[6,3,'archer'],[4,6,'raider']]},
  'ch5-mine':{mode:'capture',goal:[6,3],points:[[4,1],[5,5]],map:map('...XX...','..#s#...','..#.#...','==...=s=','..#.#...','..#ss...','...XX...','........'),enemies:[[5,1,'guard'],[6,3,'archer'],[5,6,'cavalry']]},
  'ch5-wall':{mode:'hold',goal:[2,4],hold:5,map:map('....#...','..ss#...','..#.#...','....=...','ssss=sss','..#.#...','....#...','........'),enemies:[[6,1,'archer'],[6,4,'infantry'],[6,6,'cavalry']],waves:[{turn:3,x:7,y:4,role:'infantry'}]},
  'ch6-wells':{mode:'extract',goal:[7,2],map:map('..XX....','..^.....','...=====','====.X..','.....X..','..^.....','........','....XX..'),enemies:[[5,1,'archer'],[6,5,'cavalry'],[4,7,'raider']]},
  'ch6-eagle':{mode:'extract',goal:[7,6],map:map('....XX..','..^.....','...XX...','======..','...^.=..','...X.=..','.....===','........'),enemies:[[6,1,'cavalry'],[5,4,'archer'],[6,7,'raider']]},
  'ch7-legion':{mode:'capture',goal:[6,4],points:[[5,1],[5,6]],map:map('..X.....','..X..^..','..X.....','========','.....X..','..^..X..','.....X..','........'),enemies:[[6,1,'guard'],[6,3,'archer'],[6,5,'infantry'],[4,7,'cavalry']]},
  'ch8-ferry':{mode:'extract',goal:[7,3],map:map('...~....','...~....','...~.^..','===f====','...~....','...f....','...~....','...~....'),enemies:[[6,1,'archer'],[6,4,'raider'],[5,7,'infantry']]},
  'ch8-crossing':{mode:'hold',goal:[4,4],hold:4,map:map('..~.....','..~..^..','..~.....','==f=====','..~.....','..f.....','..~...^.','..~.....'),enemies:[[6,1,'archer'],[6,4,'infantry'],[6,6,'raider']],waves:[{turn:3,x:7,y:4,role:'cavalry'}]},
  'ch9-wing':{mode:'clear',goal:[6,4],map:map('........','....^^..','...XX...','====....','........','..^^....','........','...XX...'),enemies:[[6,1,'cavalry'],[6,3,'archer'],[6,5,'cavalry'],[5,7,'infantry']]},
  'ch9-city':{mode:'capture',goal:[6,3],points:[[6,3]],map:map('....#...','....#...','....#...','====ssss','....#...','..^.#...','........','........'),enemies:[[5,2,'guard'],[6,3,'infantry'],[6,5,'archer']]},
  'ch10-road':{mode:'supply',goal:[2,3],hold:4,points:[[5,1],[5,6]],map:map('...~....','...f====','...~..^.','sss~....','===f====','...~....','...f====','...~....'),enemies:[[6,1,'raider'],[6,4,'archer'],[6,6,'raider']],waves:[{turn:4,x:7,y:4,role:'raider'}]},
  'ch12-confrontation':{mode:'clear',goal:[6,3],map:map('.....#..','..^..#..','.....#..','========','.....#..','..^..#..','........','........')}
};

export const CHAMBER_SCENARIOS={
  'ch7-council':{issue:'The legion’s deployment',layout:[[2,1],[4,1],[6,1],[2,3],[4,3],[6,3],[2,5],[4,5],[6,5]],interests:['service','security','law'],rival:'lobby',hero:[1,3],ally:[1,5]},
  'ch8-parley':{issue:'Safe passage and the grain toll',layout:[[2,1],[3,1],[5,2],[2,3],[4,4],[6,4],[2,6],[4,6],[6,6]],interests:['security','grain','law'],rival:'broker',hero:[1,3],ally:[1,5]},
  'ch10-tribunal':{issue:'Tenure, harvests and displaced households',layout:[[2,1],[4,1],[6,1],[3,3],[5,3],[6,5],[2,5],[3,6],[5,6]],interests:['law','grain','security'],rival:'lobby',hero:[1,3],ally:[1,5]},
  'ch11-accounts':{issue:'An audit of military service',layout:[[2,2],[4,1],[6,2],[2,4],[4,3],[6,4],[2,6],[4,6],[6,6]],interests:['service','law','grain'],rival:'prosecutor',hero:[1,3],ally:[1,5]},
  'ch11-adlection':{issue:'Admission, office and constitutional precedent',layout:[[2,1],[4,2],[6,1],[2,3],[4,4],[6,3],[2,5],[4,6],[6,5]],interests:['law','office','service'],rival:'prosecutor',hero:[1,3],ally:[1,5]},
  'ch12-legitimacy':{issue:'Recognition of a new emperor',layout:[[2,1],[4,1],[6,2],[2,3],[4,3],[6,4],[2,5],[4,6],[6,6]],interests:['security','law','grain'],rival:'broker',hero:[1,3],ally:[1,5]}
};

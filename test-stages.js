// Test script to verify stage advancement logic
// Run in browser console or Node with game state loaded

function testStageRequirements() {
  // Mock state for testing
  const testState = {
    turnsInStage: 0,
    majorEventsSurvivedInStage: 0,
    branches: 0,
    hasProducedFruit: false,
    allies: 0,
    firstRootActionTaken: false,
    rootZones: 0,
    leafClusters: 0,
  };

  // Copy the functions we need
  function turnsForYears(years) {
    return years * 12;
  }

  // Test each stage
  const stages = [
    {
      name: 'Seed → Sprout',
      requirements: [
        { key: 'firstRoot', label: 'Take your first action: grow roots', met: testState.firstRootActionTaken },
      ],
      testCases: [
        { desc: 'No root action', state: { ...testState, firstRootActionTaken: false }, expectedMet: false },
        { desc: 'Root action taken', state: { ...testState, firstRootActionTaken: true }, expectedMet: true },
      ]
    },
    {
      name: 'Sprout → Seedling',
      requirements: [
        { key: 'time', label: 'Live through 1 turn as a sprout', met: testState.turnsInStage >= 1 },
        { key: 'roots', label: 'Reach 2 root zones', met: testState.rootZones >= 2 },
        { key: 'leaves', label: 'Grow 2 leaf clusters', met: testState.leafClusters >= 2 },
      ],
      testCases: [
        { desc: 'No requirements met', state: { ...testState, turnsInStage: 0, rootZones: 0, leafClusters: 0 }, expectedMet: false },
        { desc: 'All requirements met', state: { ...testState, turnsInStage: 1, rootZones: 2, leafClusters: 2 }, expectedMet: true },
      ]
    },
    {
      name: 'Seedling → Sapling',
      requirements: [
        { key: 'time', label: 'Live through 4 seasons', met: testState.turnsInStage >= 12 },
        { key: 'major', label: 'Survive 1 major event', met: testState.majorEventsSurvivedInStage >= 1 },
      ],
      testCases: [
        { desc: 'No requirements met', state: { ...testState, turnsInStage: 0, majorEventsSurvivedInStage: 0 }, expectedMet: false },
        { desc: 'All requirements met', state: { ...testState, turnsInStage: 12, majorEventsSurvivedInStage: 1 }, expectedMet: true },
      ]
    },
    {
      name: 'Sapling → Small Tree',
      requirements: [
        { key: 'time', label: 'Live 2 years', met: testState.turnsInStage >= turnsForYears(2) },
        { key: 'branches', label: 'Grow 2 branches', met: testState.branches >= 2 },
      ],
      testCases: [
        { desc: 'No requirements met', state: { ...testState, turnsInStage: 0, branches: 0 }, expectedMet: false },
        { desc: '1 year + 2 branches', state: { ...testState, turnsInStage: 12, branches: 2 }, expectedMet: false },
        { desc: '2 years + 1 branch', state: { ...testState, turnsInStage: 24, branches: 1 }, expectedMet: false },
        { desc: '2 years + 2 branches', state: { ...testState, turnsInStage: 24, branches: 2 }, expectedMet: true },
      ]
    },
    {
      name: 'Small Tree → Mature Tree',
      requirements: [
        { key: 'time', label: 'Live 5 years', met: testState.turnsInStage >= turnsForYears(5) },
        { key: 'fruit', label: 'Produce your first fruit', met: testState.hasProducedFruit },
      ],
      testCases: [
        { desc: 'No requirements met', state: { ...testState, turnsInStage: 0, hasProducedFruit: false }, expectedMet: false },
        { desc: '5 years no fruit', state: { ...testState, turnsInStage: 60, hasProducedFruit: false }, expectedMet: false },
        { desc: 'Fruit but no time', state: { ...testState, turnsInStage: 0, hasProducedFruit: true }, expectedMet: false },
        { desc: '5 years + fruit', state: { ...testState, turnsInStage: 60, hasProducedFruit: true }, expectedMet: true },
      ]
    },
    {
      name: 'Mature Tree → Ancient',
      requirements: [
        { key: 'time', label: 'Live 10 years', met: testState.turnsInStage >= turnsForYears(10) },
        { key: 'major', label: 'Survive 3 major events', met: testState.majorEventsSurvivedInStage >= 3 },
        { key: 'allies', label: 'Have 2 allies', met: testState.allies >= 2 },
      ],
      testCases: [
        { desc: 'No requirements met', state: { ...testState, turnsInStage: 0, majorEventsSurvivedInStage: 0, allies: 0 }, expectedMet: false },
        { desc: 'All requirements met', state: { ...testState, turnsInStage: 120, majorEventsSurvivedInStage: 3, allies: 2 }, expectedMet: true },
      ]
    },
  ];

  console.log('=== Stage Advancement Tests ===\n');
  
  stages.forEach(stage => {
    console.log(`\n${stage.name}:`);
    stage.testCases.forEach(test => {
      // Re-evaluate requirements with test state
      let reqs = [];
      if (stage.name.includes('Seed →')) {
        reqs = [{ met: test.state.firstRootActionTaken }];
      } else if (stage.name.includes('Sprout')) {
        reqs = [
          test.state.turnsInStage >= 1,
          test.state.rootZones >= 2,
          test.state.leafClusters >= 2
        ].map(m => ({ met: m }));
      } else if (stage.name.includes('Seedling')) {
        reqs = [
          test.state.turnsInStage >= 12,
          test.state.majorEventsSurvivedInStage >= 1
        ].map(m => ({ met: m }));
      } else if (stage.name.includes('Sapling')) {
        reqs = [
          test.state.turnsInStage >= turnsForYears(2),
          test.state.branches >= 2
        ].map(m => ({ met: m }));
      } else if (stage.name.includes('Small Tree')) {
        reqs = [
          test.state.turnsInStage >= turnsForYears(5),
          test.state.hasProducedFruit
        ].map(m => ({ met: m }));
      } else if (stage.name.includes('Mature')) {
        reqs = [
          test.state.turnsInStage >= turnsForYears(10),
          test.state.majorEventsSurvivedInStage >= 3,
          test.state.allies >= 2
        ].map(m => ({ met: m }));
      }
      
      const allMet = reqs.every(r => r.met);
      const passed = allMet === test.expectedMet;
      const status = passed ? '✓' : '✗';
      console.log(`  ${status} ${test.desc}: ${allMet ? 'MET' : 'NOT MET'} (expected: ${test.expectedMet ? 'MET' : 'NOT MET'})`);
    });
  });
  
  console.log('\n=== Timing Reference ===');
  console.log('Turns per year: 12 (3 turns × 4 seasons)');
  console.log('Sapling → Small Tree: 2 years = 24 turns');
  console.log('Small Tree → Mature Tree: 5 years = 60 turns');
  console.log('Mature Tree → Ancient: 10 years = 120 turns');
}

testStageRequirements();

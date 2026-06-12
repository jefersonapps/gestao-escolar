import type { SchoolConfig, Professor, ClassGroup, Subject, Lesson, Stage } from '../types';
import { isProfessorAvailable } from '../lib/constraints';
import { v4 as uuidv4 } from 'uuid';

interface GeneratorInput {
  schoolConfig: SchoolConfig;
  professors: Professor[];
  subjects: Subject[];
  classes: ClassGroup[];
  stages: Stage[];
  existingLessons?: Lesson[];
  overlapMap: Record<string, string[]>;
  slotToDayId: Record<string, string>;
}

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------
const SETTINGS = {
  POPULATION_SIZE: 100,
  MAX_GENERATIONS: 3000,
  ELITISM_PERCENT: 0.05,
  BASE_MUTATION_RATE: 0.1,
  MUTATION_RATE_ADJUSTMENT_TRIGGER: 0.01, 
  GENERATION_TOLERANCE: 100, 
};

// WEIGHTS
const WEIGHTS = {
  HARD_CONFLICT: 10000, 
  CONSECUTIVE_VIOLATION: 5000,
  GAP: 50,              
  ISOLATED: 200,        
  DISTRIBUTION: 20,     
  PATTERN: 10,          
  INSTRUCTOR_LOAD: 30,  
};

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
interface Gene {
  allocationId: string;
  dayId: string;
  slotId: string;
  isLockedBlock?: boolean; // If part of a forced block
}

interface Chromosome {
  genes: Gene[];
  fitness: number;
}

// ---------------------------------------------------------------------------
// WORKER
// ---------------------------------------------------------------------------
self.onmessage = (e: MessageEvent<GeneratorInput>) => {
  const { schoolConfig, professors: rawProfessors, classes, subjects, existingLessons, stages, overlapMap, slotToDayId } = e.data;
  
  // Clone professors
  const professors = rawProfessors.map(p => ({ ...p, unavailableSlots: [...(p.unavailableSlots || [])] }));

  // Expand unavailable slots based on overlaps (Static Constraints)
  professors.forEach(prof => {
      const expandedSlots: string[] = [];
      prof.unavailableSlots.forEach(key => {
          const [, slotId] = key.split('|');
          if (overlapMap[slotId]) {
              overlapMap[slotId].forEach(ovSlotId => {
                  const ovDayId = slotToDayId[ovSlotId];
                  if (ovDayId) {
                      const ovKey = `${ovDayId}|${ovSlotId}`;
                      if (!prof.unavailableSlots.includes(ovKey) && !expandedSlots.includes(ovKey)) {
                          expandedSlots.push(ovKey);
                      }
                  }
              });
          }
      });
      prof.unavailableSlots.push(...expandedSlots);
  });

  // Process Existing Lessons & Static Constraints
  if (existingLessons) {
      existingLessons.forEach(l => {
          const prof = professors.find(p => p.id === l.professorId);
          if (prof) {
              // Block the actual slot
              const key = `${l.dayId}|${l.slotId}`;
              if (!prof.unavailableSlots.includes(key)) prof.unavailableSlots.push(key);

              // Block all overlapping slots
              if (overlapMap[l.slotId]) {
                  overlapMap[l.slotId].forEach(conflictingSlotId => {
                      const conflictDayId = slotToDayId[conflictingSlotId];
                      if (conflictDayId) {
                          const conflictKey = `${conflictDayId}|${conflictingSlotId}`;
                          if (!prof.unavailableSlots.includes(conflictKey)) prof.unavailableSlots.push(conflictKey);
                      }
                  });
              }
          }
      });
  }

  // 1. Map Valid Slots per Class (Stage-aware)
  // Map ClassId -> List of { dayId, slotId, originalIndex }
  const classSlotsMap = new Map<string, { dayId: string, slotId: string, originalIndex: number }[]>();
  const classDayDetails = new Map<string, Map<string, any[]>>(); // ClassId -> DayId -> Slots[]

  classes.forEach(cls => {
      // Determine configuration for this class
      const stage = cls.stageId ? stages.find(s => s.id === cls.stageId) : null;
      const daysConfig = (stage && stage.days) ? stage.days : schoolConfig.days;
      
      const validSlots: { dayId: string, slotId: string, originalIndex: number }[] = [];
      const dayMap = new Map<string, any[]>();

      daysConfig?.forEach(day => {
          if (day.enabled) {
              dayMap.set(day.id, day.slots);
              day.slots.forEach((slot, idx) => {
                  if (!slot.isInterval) {
                      validSlots.push({ dayId: day.id, slotId: slot.id, originalIndex: idx });
                  }
              });
          }
      });
      
      classSlotsMap.set(cls.id, validSlots);
      classDayDetails.set(cls.id, dayMap);
  });

  const getSlotIndexForClass = (classId: string, dayId: string, slotId: string) => {
      const daySlots = classDayDetails.get(classId)?.get(dayId);
      return daySlots?.findIndex(s => s.id === slotId) ?? -1;
  };

  // Helper to check dynamic collisions (genes)
  const isTimeOccupiedByProf = (profId: string, slotId: string, occupiedSet: Set<string>) => {
      // Check direct slot
      const key = `P:${profId}-${slotId}`;
      if (occupiedSet.has(key)) return true;

      // Check overlapping slots
      const overlaps = overlapMap[slotId];
      if (overlaps) {
          for (const ov of overlaps) {
              if (occupiedSet.has(`P:${profId}-${ov}`)) return true;
          }
      }
      return false;
  };

  // -------------------------------------------------------------------------
  // 2. PREPARE GENES
  // -------------------------------------------------------------------------
  const requiredGenes: {
     allocationId: string;
     professorId: string;
     classGroupId: string;
     subjectId: string;
     blockId?: string; 
  }[] = [];

  professors.forEach(prof => {
      prof.allocations.forEach(alloc => {
          // Only create genes for classes that are in the input list
          if (!classes.find(c => c.id === alloc.classGroupId)) return;

          const blockSize = (prof.minConsecutiveLessons || 1) > 1 ? prof.minConsecutiveLessons : 1;
          let lessonsCreated = 0;
          
          while (lessonsCreated < alloc.lessonsPerWeek) {
              const currentBlockSize = Math.min(blockSize, alloc.lessonsPerWeek - lessonsCreated);
              const blockId = currentBlockSize > 1 ? uuidv4() : undefined;
              
              for (let k = 0; k < currentBlockSize; k++) {
                   requiredGenes.push({
                      allocationId: `${prof.id}-${alloc.classGroupId}-${alloc.subjectId}-${lessonsCreated}`,
                      professorId: prof.id,
                      classGroupId: alloc.classGroupId,
                      subjectId: alloc.subjectId,
                      blockId: blockId
                   });
                   lessonsCreated++;
              }
          }
      });
  });

  // -------------------------------------------------------------------------
  // 3. HEURISTIC INITIALIZATION
  // -------------------------------------------------------------------------
  const generateHeuristicChromosome = (): Chromosome => {
      const genes: Gene[] = [];
      const occupied = new Set<string>();
      
      const blocks = new Map<string, typeof requiredGenes>();
      const singles: typeof requiredGenes = [];
      
      requiredGenes.forEach(req => {
          if (req.blockId) {
              if (!blocks.has(req.blockId)) blocks.set(req.blockId, []);
              blocks.get(req.blockId)!.push(req);
          } else {
              singles.push(req);
          }
      });
      
      const blockList = Array.from(blocks.values());
      
      const findBlockStart = (size: number, profId: string, classId: string) => {
          const validSlots = classSlotsMap.get(classId) || [];
          const starts = [...validSlots].sort(() => Math.random() - 0.5);
          
          for (const start of starts) {
                const daySlots = classDayDetails.get(classId)?.get(start.dayId)!;
                if (!daySlots) continue;

                const sequence: { dayId: string, slotId: string }[] = [];
                let validSequence = true;
                
                for (let k = 0; k < size; k++) {
                    const idx = start.originalIndex + k;
                    if (idx >= daySlots.length) { validSequence = false; break; }
                    
                    const slot = daySlots[idx];
                    if (slot.isInterval) { validSequence = false; break; }
                    
                    // Check occupation (Class)
                    const classKey = `C:${classId}-${start.dayId}-${slot.id}`;
                    if (occupied.has(classKey)) { validSequence = false; break; }

                    // Check occupation (Prof)
                    if (isTimeOccupiedByProf(profId, slot.id, occupied)) { 
                        validSequence = false; break; 
                    }

                    // Check prof availability (Static)
                    const prof = professors.find(p => p.id === profId);
                    if (prof && !isProfessorAvailable(prof, start.dayId, slot.id)) { validSequence = false; break; }
                    
                    sequence.push({ dayId: start.dayId, slotId: slot.id });
                }
                
                if (validSequence) return sequence;
          }
          return null;
      };

      // 1. PLACE BLOCKS
      for (const block of blockList) {
          const size = block.length;
          const req = block[0];
          const slots = findBlockStart(size, req.professorId, req.classGroupId);
          
          if (slots) {
              for (let i = 0; i < size; i++) {
                  genes.push({
                      allocationId: block[i].allocationId,
                      dayId: slots[i].dayId,
                      slotId: slots[i].slotId,
                      isLockedBlock: true
                  });
                  occupied.add(`C:${req.classGroupId}-${slots[i].dayId}-${slots[i].slotId}`);
                  occupied.add(`P:${req.professorId}-${slots[i].slotId}`);
              }
          } else {
              // Fallback
              const validSlots = classSlotsMap.get(req.classGroupId) || [];
              if (validSlots.length > 0) {
                   const startIdx = Math.floor(Math.random() * validSlots.length); 
                   block.forEach((r, idx) => {
                       const rand = validSlots[(startIdx + idx) % validSlots.length];
                       genes.push({
                           allocationId: r.allocationId,
                           dayId: rand.dayId,
                           slotId: rand.slotId
                       });
                   });
              } else {
                  // Should essentially never happen unless config is empty
                  block.forEach(r => {
                      genes.push({ allocationId: r.allocationId, dayId: '?', slotId: '?' });
                  });
              }
          }
      }
      
      // 2. PLACE SINGLES
      for (const req of singles) {
           let placed = false;
           const validSlots = classSlotsMap.get(req.classGroupId) || [];
           
           if (validSlots.length > 0) {
               for (let i = 0; i < SETTINGS.GENERATION_TOLERANCE; i++) {
                   const cand = validSlots[Math.floor(Math.random() * validSlots.length)];
                   const classKey = `C:${req.classGroupId}-${cand.dayId}-${cand.slotId}`;
                   
                   if (!occupied.has(classKey) && !isTimeOccupiedByProf(req.professorId, cand.slotId, occupied)) {
                       const prof = professors.find(p => p.id === req.professorId);
                       if (prof && isProfessorAvailable(prof, cand.dayId, cand.slotId)) {
                           genes.push({
                               allocationId: req.allocationId,
                               dayId: cand.dayId,
                               slotId: cand.slotId
                           });
                           occupied.add(classKey);
                           occupied.add(`P:${req.professorId}-${cand.slotId}`);
                           placed = true;
                           break;
                       }
                   }
               }
               if (!placed) {
                   const cand = validSlots[Math.floor(Math.random() * validSlots.length)];
                   genes.push({
                       allocationId: req.allocationId,
                       dayId: cand.dayId,
                       slotId: cand.slotId
                   });
               }
           } else {
               genes.push({ allocationId: req.allocationId, dayId: '?', slotId: '?' });
           }
      }

      const orderedGenes = requiredGenes.map(req => genes.find(g => g.allocationId === req.allocationId)!);
      return { genes: orderedGenes, fitness: 0 };
  };

  // -------------------------------------------------------------------------
  // 4. FITNESS FUNCTION
  // -------------------------------------------------------------------------
  const calculateFitness = (genes: Gene[]): number => {
      let penalty = 0;
      
      const classSchedule = new Map<string, number>(); 
      const profSchedule = new Map<string, number>();  
      
      const geneMap = new Map<string, Gene>(); 
      genes.forEach(g => geneMap.set(g.allocationId, g));

      // 1. Basic Conflicts
      for (let i = 0; i < genes.length; i++) {
          const gene = genes[i];
          const req = requiredGenes[i];
          
          if (gene.dayId === '?' || gene.slotId === '?') {
              penalty += WEIGHTS.HARD_CONFLICT * 10;
              continue;
          }

          // Class Conflict
          const classKey = `${req.classGroupId}-${gene.dayId}-${gene.slotId}`;
          if (classSchedule.has(classKey)) penalty += WEIGHTS.HARD_CONFLICT;
          classSchedule.set(classKey, 1);

          // Professor Conflict (Overlap Aware)
          const profKey = `${req.professorId}-${gene.slotId}`;
          if (profSchedule.has(profKey)) {
              penalty += WEIGHTS.HARD_CONFLICT;
          } else {
              // Check overlaps
              const overlaps = overlapMap[gene.slotId];
              if (overlaps) {
                  for (const ov of overlaps) {
                      if (profSchedule.has(`${req.professorId}-${ov}`)) {
                          penalty += WEIGHTS.HARD_CONFLICT;
                          break;
                      }
                  }
              }
          }
          profSchedule.set(profKey, 1);

          const prof = professors.find(p => p.id === req.professorId);
          if (prof && !isProfessorAvailable(prof, gene.dayId, gene.slotId)) {
               penalty += WEIGHTS.HARD_CONFLICT;
          }
      }

      // 2. Block Integrity
      const blocksObj = new Map<string, typeof requiredGenes>();
      requiredGenes.forEach(r => {
          if (r.blockId) {
              if (!blocksObj.has(r.blockId)) blocksObj.set(r.blockId, []);
              blocksObj.get(r.blockId)!.push(r);
          }
      });

      for (const reqs of blocksObj.values()) {
          const blockGenes = reqs.map(r => geneMap.get(r.allocationId)!);
          const dayId = blockGenes[0].dayId;
          const sameDay = blockGenes.every(g => g.dayId === dayId);
          
          if (!sameDay) {
              penalty += WEIGHTS.CONSECUTIVE_VIOLATION * reqs.length;
              continue;
          }
          
          const classId = reqs[0].classGroupId;
          const indices = blockGenes.map(g => getSlotIndexForClass(classId, g.dayId, g.slotId)).sort((a,b) => a - b);
          
          for (let k = 0; k < indices.length - 1; k++) {
              if (indices[k+1] !== indices[k] + 1) {
                  penalty += WEIGHTS.CONSECUTIVE_VIOLATION; 
              }
          }
      }
      return penalty;
  };

  // -------------------------------------------------------------------------
  // 5. GA LOOP
  // -------------------------------------------------------------------------
  let population: Chromosome[] = [];
  for (let i = 0; i < SETTINGS.POPULATION_SIZE; i++) {
      const c = generateHeuristicChromosome();
      c.fitness = calculateFitness(c.genes);
      population.push(c);
  }

  let generation = 0;
  let mutationRate = SETTINGS.BASE_MUTATION_RATE;
  let lastBestFitness = Infinity; 

  const mutate = (c: Chromosome) => {
      const genesToMutate = new Set<number>();
      for(let i=0; i<c.genes.length; i++) {
          if (Math.random() < mutationRate) genesToMutate.add(i);
      }
      
      genesToMutate.forEach(idx => {
          const req = requiredGenes[idx];
          const validSlots = classSlotsMap.get(req.classGroupId) || [];
          
          if (validSlots.length === 0) return;

          if (req.blockId) {
             const blockIndices = requiredGenes
                .map((r, ri) => r.blockId === req.blockId ? ri : -1)
                .filter(ri => ri !== -1);
             const size = blockIndices.length;
             
              const randStart = validSlots[Math.floor(Math.random() * validSlots.length)];
              const daySlots = classDayDetails.get(req.classGroupId)?.get(randStart.dayId);
              
              if (daySlots) {
                  let fits = true;
                  const newSlots: {dayId:string, slotId:string}[] = [];
                  for(let k=0; k<size; k++) {
                      if (randStart.originalIndex + k >= daySlots.length) { fits=false; break; }
                      const sl = daySlots[randStart.originalIndex + k];
                      if (sl.isInterval) { fits=false; break; }
                      newSlots.push({ dayId: randStart.dayId, slotId: sl.id });
                  }
                  
                  if (fits) {
                      blockIndices.forEach((bi, k) => {
                          c.genes[bi].dayId = newSlots[k].dayId;
                          c.genes[bi].slotId = newSlots[k].slotId;
                      });
                  }
              }
          } else {
              const cand = validSlots[Math.floor(Math.random() * validSlots.length)];
               c.genes[idx].dayId = cand.dayId;
               c.genes[idx].slotId = cand.slotId;
          }
      });
  };

  const crossover = (p1: Chromosome, p2: Chromosome): Chromosome => {
      const childGenes: Gene[] = [];
      const classIds = new Set(requiredGenes.map(r => r.classGroupId));
      const source = new Map<string, Chromosome>();
      classIds.forEach(cid => source.set(cid, Math.random() > 0.5 ? p1 : p2));
      
      for(let i=0; i<requiredGenes.length; i++) {
          const s = source.get(requiredGenes[i].classGroupId)!;
          childGenes.push({ ...s.genes[i] });
      }
      return { genes: childGenes, fitness: 0 };
  };

  while (generation < SETTINGS.MAX_GENERATIONS) {
      population.sort((a,b) => a.fitness - b.fitness);
      const best = population[0];
      
      if (best.fitness === 0) break;
      
      if (generation % 20 === 0) {
          self.postMessage({ type: 'progress', payload: { generation, fitness: best.fitness }});
          if (best.fitness >= lastBestFitness) {
              mutationRate = Math.min(mutationRate + 0.05, 0.4);
          } else {
              mutationRate = Math.max(mutationRate - 0.01, SETTINGS.BASE_MUTATION_RATE);
          }
          lastBestFitness = best.fitness;
      }
      
      const newPop = population.slice(0, Math.floor(SETTINGS.POPULATION_SIZE * SETTINGS.ELITISM_PERCENT));
      while (newPop.length < SETTINGS.POPULATION_SIZE) {
          const p1 = population[Math.floor(Math.random() * 20)]; 
          const p2 = population[Math.floor(Math.random() * population.length)];
          const child = crossover(p1, p2);
          mutate(child);
          child.fitness = calculateFitness(child.genes);
          newPop.push(child);
      }
      population = newPop;
      generation++;
  }

  const best = population[0];
  const finalSchedule: Lesson[] = best.genes.map((g, i) => ({
      id: uuidv4(),
      classGroupId: requiredGenes[i].classGroupId,
      subjectId: requiredGenes[i].subjectId,
      professorId: requiredGenes[i].professorId,
      dayId: g.dayId,
      slotId: g.slotId
  }));

   const conflicts: any[] = [];
   const schedule = finalSchedule;
   
   for (let i = 0; i < finalSchedule.length; i++) {
        const lesson = finalSchedule[i];
        if (lesson.dayId === '?' || lesson.slotId === '?') continue;

        const prof = professors.find(p => p.id === lesson.professorId);
        if (prof && !isProfessorAvailable(prof, lesson.dayId, lesson.slotId)) {
             conflicts.push({
                 type: 'unavailable',
                 professorId: prof.id,
                 professorName: prof.name,
                 subjectId: lesson.subjectId,
                 subjectName: subjects.find(s=>s.id===lesson.subjectId)?.name,
                 classGroupId: lesson.classGroupId,
                 className: classes.find(c=>c.id===lesson.classGroupId)?.name,
                 dayId: lesson.dayId,
                 dayName: '',
                 slotId: lesson.slotId,
                 message: "Professor indisponível"
             });
        }

        const overlappingSlotIds = overlapMap[lesson.slotId] || [];
        const overlaps = schedule.filter(l => 
            l.professorId === lesson.professorId && 
            l.id !== lesson.id &&
            (l.slotId === lesson.slotId || overlappingSlotIds.includes(l.slotId)) 
        );
        if (overlaps.length > 0) {
             conflicts.push({
                 type: 'busy',
                 professorId: lesson.professorId,
                 professorName: prof?.name || '',
                 subjectId: lesson.subjectId,
                 subjectName: subjects.find(s=>s.id===lesson.subjectId)?.name,
                 classGroupId: lesson.classGroupId,
                 className: classes.find(c=>c.id===lesson.classGroupId)?.name,
                 dayId: lesson.dayId,
                 dayName: '',
                 slotId: lesson.slotId,
                 message: "Conflito de horário do professor"
             });
        }
   }
   
   const uniqueConflicts = conflicts.filter((v,i,a)=>a.findIndex(t=>(t.message === v.message && t.professorId === v.professorId && t.dayId === v.dayId && t.slotId === v.slotId))===i);

   self.postMessage({ 
       type: 'done', 
       payload: { 
           result: finalSchedule, 
           conflicts: uniqueConflicts.slice(0, 50) 
       } 
   });
};

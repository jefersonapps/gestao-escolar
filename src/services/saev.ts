import { fetch } from '@tauri-apps/plugin-http';
import type { IExternalAuthService, ExternalUser } from '../types/auth';

/**
 * Service to interact with SAEV (Sistema de Avaliação Educar pra Valer)
 * This service handles authentication and data scraping for reports.
 */
export class SaevService implements IExternalAuthService {
  private baseUrl = 'https://saev.abc.br';
  // private sessionToken: string | null = null; 

  async checkSession(): Promise<boolean> {
      try {
          if (!this.accessToken) return false;
          
          const response = await fetch(`${this.apiBaseUrl}/states`, { 
              method: 'GET',
              headers: this.getAuthHeaders()
          });
          return response.ok;
      } catch (e) {
          console.error('Saev session check error:', e);
          return false;
      }
  }

  private getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
  }

  private apiBaseUrl = 'https://api.saev.abc.br/v1';
  private accessToken: string | null = null;

  async login(email: string, pass: string): Promise<boolean> {
    try {
      console.log('--- SAEV Login Debug ---');
      console.log('1. Sending JSON login request to API...');
      
      const response = await fetch(`${this.apiBaseUrl}/login`, {
          method: 'POST',
          headers: {
              ...this.getHeaders(),
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              USU_EMAIL: email,
              USU_SENHA: pass
          })
      });

      console.log('2. Login API Result:', {
          status: response.status,
          ok: response.ok
      });

      if (response.ok) {
          const data = await response.json() as any;
          if (data.access_token) {
              console.log('3. Login SUCCESS - Token received');
              this.accessToken = data.access_token;
              // Also navigate to /login and /home in the browser (via cookie if possible)
              // But for our scraping, we just need the token.
              return true;
          }
      }
      
      console.warn('3. Login FAILED: Unexpected response or missing token');
      return false;
    } catch (e) {
      console.error('Login ERROR:', e);
      return false;
    }
  }

  private getAuthHeaders() {
      const headers: any = this.getHeaders();
      if (this.accessToken) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
      return headers;
  }

  async getUserProfile(): Promise<ExternalUser | null> {
      try {
          // Scrape the home page or account page for the user name
          const response = await fetch(`${this.baseUrl}/home`, {
              headers: this.getAuthHeaders()
          });
          if (!response.ok) return null;
          
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          // Based on the HTML snippet: <div class="styledComponents__UserInfo-sc-1qr83ce-3 gqcrCS"><strong>Maria Vânia de Freitas Silva</strong><br>Admin Escola</div>
          const userInfo = doc.querySelector('[class*="UserInfo"]');
          const name = userInfo?.querySelector('strong')?.textContent || 'Usuário SAEV';
          const role = userInfo?.textContent?.replace(name, '').trim() || 'Admin';

          return {
              name,
              email: '', // Often not visible on the main page
              role
          };
      } catch (e) {
          console.error('Error fetching Saev user profile:', e);
          return null;
      }
  }

  /**
   * Fetches report data from the SAEV API for a given set of filters.
   * Scrapes the general-synthesis endpoint.
   */
  async scrapeReportData(filters: any) {
      try {
          const token = this.accessToken;
          if (!token) {
              console.error('[SaevService] No access token for scrapeReportData');
              return null;
          }

          const allCsvData: any[] = [];
          const allFluencyData: any[] = [];
          const seenStudentSubject = new Set<string>();
          const labelMap: Record<string, string> = {
              'fluente': 'Fluente', 'nao_fluente': 'Não Fluente', 'frases': 'Frases',
              'palavras': 'Palavras', 'silabas': 'Sílabas', 'nao_leitor': 'Não Leitor',
              'nao_avaliado': 'Não Avaliado', 'nao_informado': 'Não informado',
              'Fluente': 'Fluente', 'Não Fluente': 'Não Fluente', 'Frases': 'Frases',
              'Palavras': 'Palavras', 'Sílabas': 'Sílabas', 'Não Leitor': 'Não Leitor',
              'Não Avaliado': 'Não Avaliado', 'Não informado': 'Não informado',
              'nao leitor': 'Não Leitor', 'nao fluente': 'Não Fluente', 'nao avaliado': 'Não Avaliado'
          };

          const subjectsToFetch = ['1', '2', '9999']; // 1=Português, 2=Matemática, 9999=Leitura

          for (const subjectId of subjectsToFetch) {
              const queryParams = new URLSearchParams({
                  page: '1',
                  params: subjectId,
                  serie: filters.serie || '',
                  year: filters.ano || '',
                  edition: filters.edicao || '',
                  isEpvPartner: '0', 
                  typeSchool: filters.rede || '',
                  stateId: filters.estado || '',
                  stateRegionalId: filters.regionalEstadual || '',
                  county: filters.municipio || '',
                  municipalityOrUniqueRegionalId: filters.regionalMunicipal || '',
                  school: filters.escola || '',
                  schoolClass: filters.turma || ''
              });

              const url = `${this.apiBaseUrl}/reports/general-synthesis?${queryParams.toString()}`;
              console.log(`[SaevService] Fetching general-synthesis for subject ${subjectId}: ${url}`);
              
              const response = await this.fetchWithRetry(url, { headers: this.getAuthHeaders() }).catch(err => {
                  console.warn(`[SaevService] Subject ${subjectId} fetch failed:`, err);
                  return null;
              });

              if (!response || !response.ok) continue;

              const data = await response.json() as any;
              if (!data || !data.items || !Array.isArray(data.items)) continue;

              console.log(`[SaevService] Mapping subject ${subjectId} data. Items:`, data.items.length);

              data.items.forEach((item: any) => {
                  if (item.type === 'table' && item.subject) {
                      const subject = item.subject;
                      if (item.students && Array.isArray(item.students)) {
                          if (item.students.length > 0) {
                              console.log(`[SaevService] RAW student sample (${subject}):`, JSON.stringify(item.students[0], null, 2));
                          }
                          item.students.forEach((s: any) => {
                              const studentName = s.name || s.nome || '';
                              const studentKey = `${studentName}_${subject}`.toLowerCase();
                              if (seenStudentSubject.has(studentKey)) return;
                              seenStudentSubject.add(studentKey);
                              
                              const nivelRaw = s.type || s.level || s.nivel || '';
                              const nivel = labelMap[nivelRaw] || nivelRaw;
                              const questions = new Map<number, { answer: string; correct: boolean }>();
                              let media = s.percentage || s.average || s.media || s.percent_hit || '';
                              let nivelNum = s.level_num || s.nivelNum || s.nivel_num || '';

                              const processKeys = (obj: any, depth = 0, visited = new Set<any>()) => {
                                if (!obj || depth > 10 || visited.has(obj)) return;
                                visited.add(obj);
                                
                                // 1. Handle explicit 'quests' array
                                // IMPORTANT: Use idx + 1 because IDs might be huge database IDs
                                if (obj.quests && Array.isArray(obj.quests)) {
                                    obj.quests.forEach((q: any, idx: number) => {
                                        const qNum = idx + 1;
                                        const ans = q.letter || q.value || q.answer || '';
                                        const isCorrect = q.status === 'right' || q.type === 'right' || q.hit === 1 || q.correct === true;
                                        if (ans) questions.set(qNum, { answer: ans, correct: isCorrect });
                                    });
                                }

                                // 2. Handle 'responses' array (simplified form seen in logs)
                                if (obj.responses && Array.isArray(obj.responses)) {
                                    obj.responses.forEach((ans: any, idx: number) => {
                                        const qNum = idx + 1;
                                        if (ans) {
                                            if (typeof ans === 'object') {
                                                questions.set(qNum, { 
                                                    answer: ans.letter || ans.value || '-', 
                                                    correct: ans.status === 'right' || ans.hit === 1 
                                                });
                                            } else {
                                                if (!questions.has(qNum)) {
                                                     questions.set(qNum, { answer: String(ans), correct: false });
                                                }
                                            }
                                        }
                                    });
                                }

                                // 3. Handle legacy/individual keys (q1, q2, etc.)
                                Object.keys(obj).forEach(k => {
                                    const qNumMatch = k.match(/^(?:q|QUEST_?|QUESTAO_?)?(\d+)$/i);
                                    if (qNumMatch) {
                                        const qNum = parseInt(qNumMatch[1]);
                                        if (questions.has(qNum)) return; 

                                        const val = obj[k];
                                        let ans = '', correct = false;
                                        if (typeof val === 'object' && val !== null) {
                                            ans = val.label || val.value || val.answer || val.text || val.alternativa || '-';
                                            correct = val.hit === 1 || val.hit === true || val.correct === true || val.status === 'right' || val.type === 'right';
                                        } else if (typeof val === 'string' || typeof val === 'number') {
                                            ans = String(val);
                                            const hitKeys = [`${k}_hit`, `${k}_acerto`, `${k}_is_correct`, `${k}_correto`, `hit_${k}`, `acerto_${k}`, `${k}_type`];
                                            const hitVal = hitKeys.map(key => obj[key]).find(v => v !== undefined);
                                            if (hitVal !== undefined) {
                                                correct = hitVal === 1 || hitVal === true || hitVal === '1' || hitVal === 'right' || String(hitVal).toUpperCase() === 'S';
                                            }
                                        }
                                        if (ans && ans !== 'undefined') questions.set(qNum, { answer: ans, correct });
                                    } else if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
                                        if (['questions', 'answers', 'respostas', 'resultados', 'results'].includes(k.toLowerCase())) {
                                            processKeys(obj[k], depth + 1, visited);
                                        }
                                    }
                                });
                              };
                              processKeys(s);
                              if (media && !String(media).includes('%')) media = `${media}%`;

                              allFluencyData.push({
                                  nome: s.name || s.nome || '',
                                  nivel: nivel,
                                  materia: subject,
                                  media: media,
                                  nivelNum: nivelNum,
                                  questions: questions
                              });
                          });
                      }
                  }

                  if (item.type === 'chart' && item.data && Array.isArray(item.data)) {
                      if (item.title?.toLowerCase().includes('nível') || item.title?.toLowerCase().includes('leitura')) {
                          const levelsRows = item.data.map((d: any) => ({
                              edicao: d.label || d.name || filters.edicao,
                              total_alunos: d.total || d.count || 0,
                              fluente: d.fluente || 0,
                              nao_fluente: d.nao_fluente || 0,
                              frases: d.frases || 0,
                              palavras: d.palavras || 0,
                              silabas: d.silabas || 0,
                              nao_leitor: d.nao_leitor || 0,
                              nao_avaliado: d.nao_avaliado || 0,
                              nao_informado: d.nao_informado || 0
                          }));
                          allCsvData.push({ type: 'LEVELS_SUMMARY', data: levelsRows });
                      }
                  }
              });
          }
          
          if (allFluencyData.length > 0) {
              allCsvData.push({ type: 'FLUENCY_DETAIL', data: allFluencyData });
          }

          // --- EVOLUTIONARY LINE FETCH ---
          try {
              const evoParams = new URLSearchParams({
                  page: '1',
                  limit: '999999',
                  serie: filters.serie || '',
                  year: filters.ano || '',
                  isEpvPartner: '0', 
                  typeSchool: filters.rede || '',
                  stateId: filters.estado || '',
                  stateRegionalId: filters.regionalEstadual || '',
                  county: filters.municipio || '',
                  municipalityOrUniqueRegionalId: filters.regionalMunicipal || '',
                  school: filters.escola || '',
                  schoolClass: filters.turma || ''
              });

              const evoUrl = `${this.apiBaseUrl}/reports/evolutionary-line?${evoParams.toString()}`;
              console.log(`[SaevService] Fetching evolutionary-line: ${evoUrl}`);
              
              const evoResponse = await this.fetchWithRetry(evoUrl, { headers: this.getAuthHeaders() }).catch((err: any) => {
                  console.warn(`[SaevService] evolutionary-line fetch failed:`, err);
                  return null;
              });

              if (evoResponse && evoResponse.ok) {
                  const evoData = await evoResponse.json() as any;
                  
                  // Flexible mapping for Evolutionary Line
                  const rows: any[] = [];
                  const editionsMap = new Map<string, { [materia: string]: { part: number, res: number } }>();

                  const getOrCreateEdition = (ed: string) => {
                      if (!editionsMap.has(ed)) {
                          editionsMap.set(ed, {
                              'Matemática': { part: 0, res: 0 },
                              'Língua Portuguesa': { part: 0, res: 0 },
                              'Leitura': { part: 0, res: 0 }
                          });
                      }
                      return editionsMap.get(ed)!;
                  };

                  // 1. First, check if the response follows the `{"items": [{"name": "Edition", "subjects": [...]}]}` structure explicitly.
                  if (evoData && Array.isArray(evoData.items)) {
                      evoData.items.forEach((item: any) => {
                          const edName = item.name || item.edicao || item.label || filters.edicao || 'Geral';
                          const ed = getOrCreateEdition(edName);
                          
                          if (Array.isArray(item.subjects)) {
                              item.subjects.forEach((subj: any) => {
                                  const sName = (subj.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                  let targetSubj = '';
                                  if (sName.includes('matem')) targetSubj = 'Matemática';
                                  else if (sName.includes('portugu')) targetSubj = 'Língua Portuguesa';
                                  else if (sName.includes('leitura') || sName.includes('leit')) targetSubj = 'Leitura';

                                  if (targetSubj) {
                                      const part = subj.percentageFinished || subj.participacao || subj.part || 0;
                                      const res = subj.percentageRightQuestions || subj.acertos || subj.resultado || subj.res || 0;
                                      ed[targetSubj].part = typeof part === 'number' ? part : parseFloat(part);
                                      ed[targetSubj].res = typeof res === 'number' ? res : parseFloat(res);
                                  }
                              });
                          }
                      });
                  } else {
                      // 2. Fallback to recursive traversal for unexpected formats like Highcharts series
                      const traverseEvo = (obj: any, currentLabel: string = '') => {
                          if (!obj || typeof obj !== 'object') return;
                          
                          if (Array.isArray(obj)) {
                              obj.forEach((o: any) => traverseEvo(o, currentLabel));
                              return;
                          }

                          const label = obj.label || obj.name || obj.edicao || obj.edition || obj.ano || currentLabel;
                          const keys = Object.keys(obj);
                          
                          // Highcharts categories/series structure
                          if (obj.categories && Array.isArray(obj.categories) && obj.series && Array.isArray(obj.series)) {
                              obj.categories.forEach((cat: string, index: number) => {
                                  const ed = getOrCreateEdition(cat);
                                  obj.series.forEach((s: any) => {
                                      const sName = (s.name || '').toLowerCase();
                                      const sData = Array.isArray(s.data) ? s.data[index] : 0;
                                      
                                      if (sName.includes('matem')) {
                                          if (sName.includes('part') || sName.includes('finish')) ed['Matemática'].part = sData;
                                          if (sName.includes('res') || sName.includes('acert') || sName.includes('right')) ed['Matemática'].res = sData;
                                      } else if (sName.includes('portugu')) {
                                          if (sName.includes('part') || sName.includes('finish')) ed['Língua Portuguesa'].part = sData;
                                          if (sName.includes('res') || sName.includes('acert') || sName.includes('right')) ed['Língua Portuguesa'].res = sData;
                                      } else if (sName.includes('leit')) {
                                          if (sName.includes('part') || sName.includes('finish')) ed['Leitura'].part = sData;
                                          if (sName.includes('res') || sName.includes('acert') || sName.includes('right')) ed['Leitura'].res = sData;
                                      }
                                  });
                              });
                              return;
                          }

                          // Check for flat object approach
                          keys.forEach(k => {
                              const kl = k.toLowerCase();
                              const val = obj[k];
                              if (typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)))) {
                                  const num = typeof val === 'number' ? val : parseFloat(val);
                                  
                                  const processKey = (subjName: string, subjKeywords: string[]) => {
                                      if (subjKeywords.some(kw => kl.includes(kw))) {
                                          const ed = getOrCreateEdition(label || filters.edicao || 'Geral');
                                          if (kl.includes('part') || kl.includes('finish')) ed[subjName].part = num;
                                          if (kl.includes('res') || kl.includes('acert') || kl.includes('right')) ed[subjName].res = num;
                                      }
                                  };

                                  processKey('Matemática', ['matem', 'mat']);
                                  processKey('Língua Portuguesa', ['portugu', 'port']);
                                  processKey('Leitura', ['leitura', 'leit']);
                              } else if (typeof val === 'object') {
                                  traverseEvo(val, label);
                              }
                          });
                          
                          // Check for "item[Materia]" nested object
                          const subjects = [
                             { name: 'Matemática', keys: ['matem', 'matemática', 'matematica'] },
                             { name: 'Língua Portuguesa', keys: ['língua portuguesa', 'lingua portuguesa', 'português', 'portugues'] },
                             { name: 'Leitura', keys: ['leitura'] }
                          ];
                          
                          subjects.forEach(subj => {
                              const foundKey = keys.find(k => subj.keys.includes(k.toLowerCase()));
                              if (foundKey && typeof obj[foundKey] === 'object') {
                                  const subObj = obj[foundKey];
                                  const part = subObj.percentageFinished || subObj.participacao || subObj.participation || subObj.part || 0;
                                  const res = subObj.percentageRightQuestions || subObj.acertos || subObj.resultado || subObj.res || subObj.result || 0;
                                  if (part > 0 || res > 0) {
                                      const ed = getOrCreateEdition(label || filters.edicao || 'Geral');
                                      ed[subj.name].part = typeof part === 'number' ? part : parseFloat(part);
                                      ed[subj.name].res = typeof res === 'number' ? res : parseFloat(res);
                                  }
                              }
                          });
                      };

                      traverseEvo(evoData);
                  }

                  editionsMap.forEach((data, edicao) => {
                      Object.entries(data).forEach(([materia, fields]) => {
                          if (fields.part > 0 || fields.res > 0) {
                              rows.push({
                                  edicao,
                                  materia,
                                  participacao: fields.part,
                                  acertos: fields.res
                              });
                          }
                      });
                  });
                  
                  if (rows.length > 0) {
                      allCsvData.push({ type: 'EVOLUTION', data: rows });
                  }
              }
          } catch (e: any) {
              console.error('[SaevService] Error fetching evolutionary-line:', e);
          }

          return allCsvData.length > 0 ? allCsvData : null;
      } catch (e: any) {
          console.error('[SaevService] Error in scrapeReportData:', e);
          return null;
      }
  }


    /**
     * Fetches available options for a specific filter level based on current selections
     */
    async getFilterOptions(level: string, currentFilters: any): Promise<{ label: string, value: string }[]> {
        try {
            if (!this.accessToken) {
                console.warn('[SaevService] No access token available for fetching options');
                return [];
            }

            let url = '';
            
            switch (level) {
                case 'serie':
                    url = `${this.apiBaseUrl}/serie/all?token=${this.accessToken}&limit=9999`;
                    break;
                case 'ano':
                    url = `${this.apiBaseUrl}/assessments/years?token=${this.accessToken}&limit=9999`;
                    break;
                case 'edicao':
                    url = `${this.apiBaseUrl}/assessments?token=${this.accessToken}&serie=${currentFilters.serie || ''}&year=${currentFilters.ano || ''}&page=1&limit=999999&order=ASC`;
                    break;
                case 'rede':
                    // These are usually static: MUNICIPAL, ESTADUAL, FEDERAL, PRIVADA
                    return [
                        { label: 'MUNICIPAL', value: 'MUNICIPAL' },
                        { label: 'ESTADUAL', value: 'ESTADUAL' },
                        { label: 'FEDERAL', value: 'FEDERAL' },
                        { label: 'PRIVADA', value: 'PRIVADA' }
                    ];
                case 'estado':
                    url = `${this.apiBaseUrl}/states?token=${this.accessToken}&limit=9999`;
                    break;
                case 'regionalEstadual':
                    url = `${this.apiBaseUrl}/regional/by-filter?token=${this.accessToken}&stateId=${currentFilters.estado || ''}&type=ESTADUAL&typeSchool=${currentFilters.rede || ''}&limit=9999`;
                    break;
                case 'municipio':
                    // Counties are nested in regional/by-filter
                    url = `${this.apiBaseUrl}/regional/by-filter?token=${this.accessToken}&stateId=${currentFilters.estado || ''}&regionalId=${currentFilters.regionalEstadual || ''}&typeSchool=${currentFilters.rede || ''}&type=ESTADUAL`;
                    break;
                case 'regionalMunicipal':
                    url = `${this.apiBaseUrl}/regional/by-filter?token=${this.accessToken}&county=${currentFilters.municipio || ''}&type=MUNICIPAL&typeSchool=${currentFilters.rede || ''}`;
                    break;
                case 'escola':
                    // Schools are often nested in the municipal regional response
                    url = `${this.apiBaseUrl}/regional/by-filter?token=${this.accessToken}&id=${currentFilters.regionalMunicipal || ''}&type=MUNICIPAL&typeSchool=${currentFilters.rede || ''}`;
                    break;
                case 'turma':
                    url = `${this.apiBaseUrl}/school-class/school/${currentFilters.escola || ''}/serie/${currentFilters.serie || ''}?token=${this.accessToken}&year=${currentFilters.ano || ''}&limit=9999`;
                    break;
                default:
                    console.warn(`[SaevService] Unhandled level: ${level}`);
                    return [];
            }

            console.log(`[SaevService] Fetching ${level}. URL: ${url}`);
            
            const response = await this.fetchWithRetry(url, {
                headers: this.getAuthHeaders()
            });
            
            console.log(`[SaevService] Status for ${level}: ${response.status}`);
            if (!response.ok) {
                console.warn(`[SaevService] ${level} failed (status ${response.status})`);
                return [];
            }

            const data = await response.json() as any;
            return this.mapApiOptionsToForm(level, data);
        } catch (e) {
            console.error(`[SaevService] Error fetching ${level}:`, e);
            return [];
        }
    }

    private mapApiOptionsToForm(level: string, data: any): { label: string, value: string }[] {
        if (!data) return [];
        
        if (level === 'edicao') {
            console.log('[SaevService] Mapping edicao. Raw data snippet:', JSON.stringify(Array.isArray(data) ? data.slice(0, 2) : data).substring(0, 1000));
        }

        let items: any[] = [];
        if (Array.isArray(data)) {
            items = data;
        } else if (data.items && Array.isArray(data.items)) {
            items = data.items;
        } else if (data.data && Array.isArray(data.data)) {
            items = data.data;
        } else if (typeof data === 'object') {
            // Handle cases where data might be keyed by the level
            items = data[level] || Object.values(data).find(v => Array.isArray(v)) || [];
        }

        // Handle Hierarchical nesting (Counties/Schools inside Regionals)
        if (level === 'municipio') {
            const counties: any[] = [];
            items.forEach(item => {
                if (item.counties && Array.isArray(item.counties)) {
                    counties.push(...item.counties);
                }
            });
            if (counties.length > 0) items = counties;
        } else if (level === 'escola') {
            const schools: any[] = [];
            items.forEach(item => {
                if (item.schools && Array.isArray(item.schools)) {
                    schools.push(...item.schools);
                }
            });
            if (schools.length > 0) items = schools;
        }

        return items.map((item: any) => {
            // Mapping dynamic keys from API
            let value = '';
            let label = '';

            if (level === 'ano') {
                value = (item.ANO || item.ano || '').toString();
                label = (item.ANO || item.ano || '').toString();
            } else {
                // Value candidates (IDs)
                // Using toString() to ensure they work with Select components
                const valRaw = item.id || item.ID || item.value || 
                               item.Assessments_AVA_ID || item.AVA_ID ||
                               item.ESC_ID || item.ESC_IN_ID ||
                               item.TUR_ID || item.TUR_IN_ID ||
                               item.USU_ID || item.SER_ID || item.ANO_ID || 
                               item.EDI_ID || item.RED_ID || item.EST_ID || 
                               item.MUN_ID || item.MUN_IN_ID || '';
                value = valRaw.toString();
                
                // Label candidates (Names/Descriptions)
                const labRaw = item.name || item.NOME || item.label || 
                               item.Assessments_AVA_NOME || item.AVA_NOME ||
                               item.ESC_NOME || item.ESC_DESC ||
                               item.TUR_NOME || item.TUR_DESC ||
                               item.DESC || item.description || 
                               item.SER_NOME || item.ANO_DESC || item.EDI_DESC ||
                               item.RED_NOME || item.EST_NOME || item.MUN_NOME ||
                               item.ESC_NOME || item.TUR_NOME || value;
                label = labRaw.toString();
            }
                          
            return { label, value };
        }).filter(opt => opt.value !== '');
    }

  /**
   * Helper to fetch with retries
   */
  private async fetchWithRetry(url: string, options: any = {}, retries = 3): Promise<Response> {
      for (let i = 0; i < retries; i++) {
          try {
              const response = await fetch(url, options);
              if (response.ok) return response;
          } catch (e) {
              if (i === retries - 1) throw e;
              await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          }
      }
      throw new Error(`Failed to fetch ${url} after ${retries} retries`);
  }
}

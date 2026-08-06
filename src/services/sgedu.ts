import { fetch } from '@tauri-apps/plugin-http';
import type { IExternalAuthService, ExternalUser } from '../types/auth';

export interface SGEduClass {
  id: string;
  name: string;
  url: string;
  shift: string;
  studentsCount: number;
}

export interface SGEduStudent {
  id: string;
  name: string;
}

export class SGEduService implements IExternalAuthService {
  private static BASE_URL = 'https://www.sgedu.com.br';

  private getHeaders() {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
  }

  async checkSession(): Promise<boolean> {
      try {
          const res = await fetch(`${SGEduService.BASE_URL}/home`, {
              method: 'GET',
              headers: this.getHeaders()
          });
          const html = await res.text();
          
          // Check if we were redirected to login or the page contains the login form
          if (res.url.includes('/login') || html.includes('name="_token"') && html.includes('password')) {
              return false;
          }
          return true;
      } catch (e) {
          console.error('Session check error:', e);
          return false;
      }
  }

  async login(email: string, pass: string): Promise<boolean> {
    try {
      // 1. Get the login page to extract the CSRF token
      console.log('Fetching login page...');
      const loginPageRes = await fetch(`${SGEduService.BASE_URL}/login`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const loginPageText = await loginPageRes.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(loginPageText, 'text/html');
      const tokenInput = doc.querySelector('input[name="_token"]') as HTMLInputElement;
      const token = tokenInput?.value;

      if (!token) {
        console.error('CSRF token not found');
        return false;
      }

      console.log('Got token:', token);

      // 2. Perform Login
      // Tauri HTTP plugin doesn't support URLSearchParams body automatically like browser fetch might in some versions,
      // but it should work if we verify body format. 
      // Safest is to construct the string manually or use URLSearchParams.toString()
      const formData = new URLSearchParams();
      formData.append('_token', token);
      formData.append('email', email);
      formData.append('password', pass);
     
      const loginRes = await fetch(`${SGEduService.BASE_URL}/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData.toString()
      });

      console.log('Login response status:', loginRes.status);
      console.log('Login response url:', loginRes.url);

      // Check if redirected to home or still on login (failed)
      // Note: Tauri's fetch might handle redirects differently. 
      // loginRes.url should be the final URL.
      if (loginRes.url.includes('/home') || loginRes.url.includes('/dashboard') || (loginRes.ok && !loginRes.url.includes('login'))) {
         return true;
      }
      
      return false;
    } catch (e) {
      console.error('Login error:', e);
      return false;
    }
  }

  async getClasses(): Promise<SGEduClass[]> {
    try {
      const res = await fetch(`${SGEduService.BASE_URL}/turmas`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const rows = doc.querySelectorAll('table.table tbody tr');
      const classes: SGEduClass[] = [];

      rows.forEach(row => {
        const idCell = row.querySelector('td:nth-child(1)');
        const nameLink = row.querySelector('td:nth-child(2) a') as HTMLAnchorElement;
        const shiftCell = row.querySelector('td:nth-child(4)');
        const countBadge = row.querySelector('td:last-child .badge');

        if (idCell && nameLink) {
          const id = idCell.textContent?.trim() || '';
          const name = nameLink.textContent?.trim() || '';
          const href = nameLink.getAttribute('href') || '';
          const shift = shiftCell?.textContent?.trim() || '';
          
          let count = 0;
          if (countBadge) {
             const parts = countBadge.textContent?.split('/') || [];
             if (parts.length > 0) count = parseInt(parts[0].trim()) || 0;
          }

          classes.push({
            id,
            name,
            url: href.startsWith('http') ? href : href, 
            shift,
            studentsCount: count
          });
        }
      });

      return classes;
    } catch (e) {
      console.error('Error fetching classes:', e);
      return [];
    }
  }

  async getUserProfile(): Promise<ExternalUser | null> {
      try {
          const res = await fetch(`${SGEduService.BASE_URL}/perfil`, {
              method: 'GET',
              headers: this.getHeaders()
          });
          const html = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          const profileBox = doc.querySelector('.box-profile');
          if (!profileBox) return null;

          const name = profileBox.querySelector('.profile-username')?.textContent?.trim() || '';
          const role = profileBox.querySelector('.text-muted.text-center')?.textContent?.trim() || '';
          
          let photoUrl = '';
          const img = profileBox.querySelector('img.profile-user-img');
          if (img) {
              const src = img.getAttribute('src');
              if (src) {
                  // Handle relative URLs if necessary, though SGEdu seems to use absolute
                  if (src.startsWith('http')) {
                      photoUrl = src;
                  } else {
                      photoUrl = `${SGEduService.BASE_URL}${src}`;
                  }
              }
          }

          // Email hidden in list group
          let email = '';
          const listItems = profileBox.querySelectorAll('.list-group-item');
          listItems.forEach(li => {
              if (li.textContent?.includes('E-mail')) {
                  email = li.querySelector('a.float-right')?.textContent?.trim() || '';
              }
          });

          // Fetch image blob if url exists
          if (photoUrl) {
              try {
                  const imgRes = await fetch(photoUrl, {
                      method: 'GET',
                      headers: this.getHeaders()
                  });
                  if (imgRes.ok) {
                      const blob = await imgRes.blob();
                      // Convert to base64
                      photoUrl = await new Promise((resolve) => {
                          const reader = new FileReader();
                          reader.onloadend = () => resolve(reader.result as string);
                          reader.readAsDataURL(blob);
                      });
                  }
              } catch (err) {
                  console.error('Failed to fetch profile image blob:', err);
                  // user fallback url
              }
          }

          return { name, email, photoUrl, role };
      } catch (e) {
          console.error('Error fetching user profile:', e);
          return null;
      }
  }

  async getStudentDetails(studentId: string): Promise<Partial<import('../types').Student> | null> {
    try {
        const res = await fetch(`${SGEduService.BASE_URL}/alunos/${studentId}`, {
            method: 'GET',
            headers: this.getHeaders()
        });
        
        console.log('Fetch response status:', res.status);
        console.log('Fetch response url:', res.url);
        
        const html = await res.text();
        console.log('Fetched HTML length:', html.length);
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const title = doc.querySelector('title')?.textContent || '';
        console.log('Page Title:', title);
        
        const loginInBody = html.includes('login') || html.includes('Entrar');
        console.log('Login keyword in body:', loginInBody);
        
        // Check for specific tabs to see what loaded
        const hasResponsaveis = html.includes('id="responsaveis"');
        console.log('Has #responsaveis tab:', hasResponsaveis);

        if (hasResponsaveis) {
            const index = html.indexOf('id="responsaveis"');
            console.log('--- Content around #responsaveis ---');
            console.log(html.substring(index, index + 3000));
            console.log('------------------------------------');
        } else {
            console.log('--- Content around box-profile (fallback) ---');
            const profileIndex = html.indexOf('box-profile');
            if (profileIndex !== -1) {
                 console.log(html.substring(profileIndex, profileIndex + 3000));
            } else {
                 console.log('--- Full HTML Preview (start) ---');
                 console.log(html.substring(0, 2000));
            }
        }

        // Extract CPF and BirthDate from list items
        let cpf = '';
        let birthDate = '';
        let sus = '';
        let nis = '';
        let rg = '';
        let naturalness = '';
        let sex = '';
        let colorRace = '';
        let transport = false;
        let bolsaFamilia = false;

        const listItems = doc.querySelectorAll('.list-group-item');
        listItems.forEach(li => {
            const text = li.textContent || '';
            const val = li.querySelector('.float-right')?.textContent?.trim() || '';

            if (text.includes('Cpf:')) cpf = val;
            if (text.includes('Nascido em:')) birthDate = val.split('|')[0].trim();
            if (text.includes('Cart. SUS:')) sus = val;
            if (text.includes('NIS:')) nis = val;
            if (text.includes('RG:')) rg = val;
            if (text.includes('Natural de:')) naturalness = val;
            if (text.includes('Sexo:')) sex = val;
            if (text.includes('Cor/Raça:')) colorRace = val;
            
            if (text.includes('Usa transporte escolar:')) {
                transport = val.toLowerCase() === 'sim';
            }
            if (text.includes('Bolsa família:')) {
                bolsaFamilia = val.toLowerCase() === 'sim';
            }
        });

        // Extract Responsibles (Pai, Mãe, Responsável) from generic list group format too
        const responsibles: import('../types').Responsible[] = [];
        
        // Strategy 1: Look for definition lists (dt/dd)
        const dtElements = doc.querySelectorAll('dt');
        dtElements.forEach(dt => {
            const text = dt.textContent?.trim() || '';
            const dd = dt.nextElementSibling;
            
            if (dd && dd.tagName === 'DD') {
                let kinship = '';
                if (text.includes('Responsável')) kinship = 'Responsável';
                else if (text.includes('Pai')) kinship = 'Pai';
                else if (text.includes('Mãe')) kinship = 'Mãe';

                if (kinship) {
                    let cleanText = dd.textContent || '';
                    cleanText = cleanText.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');
                    cleanText = cleanText.replace(/\s+/g, ' ').trim();
                    
                    const parts = cleanText.split(/CPF:/i); 
                    let name = parts[0].trim();
                    name = name.replace(/[,.\-\s]+$/, '');
                    
                    let respCpf = '';
                    if (parts.length > 1) {
                        const afterCpf = parts[1].trim();
                        const cpfMatch = afterCpf.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
                        if (cpfMatch) respCpf = cpfMatch[0];
                    }

                    if (name && !responsibles.find(r => r.name === name)) {
                         responsibles.push({ name, kinship, cpf: respCpf });
                    }
                }
            }
        });

        // Strategy 2: Look in purely text blocks if definition list failed (fallback for nested text)
        if (responsibles.length === 0) {
            ['Pai', 'Mãe', 'Responsável'].forEach(kinshipTarget => {
                const bElements = Array.from(doc.querySelectorAll('b, strong'));
                const targetHeader = bElements.find(el => el.textContent?.trim().includes(kinshipTarget));
                if (targetHeader) {
                    let nextText = targetHeader.nextSibling?.textContent || '';
                    // Sometimes the name is inside a span next to it or just raw text
                    if (!nextText.trim() && targetHeader.parentElement) {
                        const parentText = targetHeader.parentElement.textContent || '';
                        nextText = parentText.substring(parentText.indexOf(kinshipTarget) + kinshipTarget.length);
                    }
                    
                    // Cleanup common delimiters like ":" or "-"
                    nextText = nextText.replace(/^[:\-\s]+/, '').trim();
                    
                    const parts = nextText.split(/CPF:/i); 
                    let name = parts[0].trim();
                    name = name.replace(/[,.\-\s]+$/, '');
                    
                    let respCpf = '';
                    if (parts.length > 1) {
                         const afterCpf = parts[1].trim();
                         const cpfMatch = afterCpf.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
                         if (cpfMatch) respCpf = cpfMatch[0];
                    }

                    if (name && !responsibles.find(r => r.name === name)) {
                        responsibles.push({ name, kinship: kinshipTarget, cpf: respCpf });
                    }
                }
            });
        }

        const validResponsibles = responsibles.filter(r => r.name && !r.name.toLowerCase().includes('não informado'));
        let responsibleName = validResponsibles.find(r => r.kinship === 'Responsável')?.name 
            || validResponsibles.find(r => r.kinship === 'Mãe')?.name 
            || validResponsibles.find(r => r.kinship === 'Pai')?.name 
            || '';

        // Extract Phones
        const phones: import('../types').Phone[] = [];
        const uniquePhones = new Set<string>();

        const addPhone = (numStr: string, contextPhrase: string) => {
            const clean = numStr.replace(/\D/g, '');
            if (clean.length < 10 || clean.length > 11 || /^0+$/.test(clean)) {
                return; // Invalid length or all zeros
            }
            
            if (!uniquePhones.has(clean)) {
                uniquePhones.add(clean);
                
                let type = 'Telefone';
                if (contextPhrase.toLowerCase().includes('cel') || contextPhrase.toLowerCase().includes('whatsapp')) type = 'Celular';
                
                let description = 'Geral';
                if (contextPhrase.toLowerCase().includes('mãe') || contextPhrase.toLowerCase().includes('mae')) description = 'Mãe';
                else if (contextPhrase.toLowerCase().includes('pai')) description = 'Pai';
                else if (contextPhrase.toLowerCase().includes('resp')) description = 'Responsável';

                phones.push({ number: numStr.trim(), type, description });
            }
        };

        // 1. Aggressive Master Regex over the exact main page HTML
        // Matches (XX) XXXX-XXXX or (XX) XXXXX-XXXX with optional space
        const strictPhonePattern = /\(\d{2}\)\s*\d{4,5}[-\s]\d{4}/g;
        let match;
        while ((match = strictPhonePattern.exec(html)) !== null) {
            const num = match[0];
            const start = Math.max(0, match.index - 40);
            const end = Math.min(html.length, match.index + num.length + 40);
            const context = html.substring(start, end).replace(/<[^>]+>/g, ' '); // Strip HTML around it
            addPhone(num, context);
        }

        // 2. Fetch directly from the Vue API if the <telefones> tag gives us the ent_id
        let entId = '';
        let authUserId = '';
        const envIdMatch = html.match(/<telefones[^>]+ent_id="([^"]+)"/i);
        if (envIdMatch) {
             entId = envIdMatch[1];
        }
        
        const authMatch = html.match(/<telefones[^>]+userid="([^"]+)"/i);
        if (authMatch) {
             authUserId = authMatch[1];
        }

        if (entId && authUserId) {
             try {
                 const headers = this.getHeaders() as Record<string, string>;
                 let csrfToken = '';
                 
                 // Extract raw CSRF-TOKEN from HTML meta head instead of cookies 
                 // (Tauri plugin fetch hides cookies from us)
                 const metaMatch = html.match(/meta\s+name="csrf-token"\s+content="([^"]+)"/i);
                 if (metaMatch) {
                     csrfToken = metaMatch[1];
                 }

                 const apiRes = await fetch(`${SGEduService.BASE_URL}/api/telefone/get`, {
                     method: 'POST',
                     credentials: 'include',
                     headers: {
                         ...headers,
                         'Authorization': `Bearer ${authUserId}`,
                         'X-Requested-With': 'XMLHttpRequest',
                         'Accept': 'application/json, text/plain, */*',
                         'Content-Type': 'application/json',
                         'X-CSRF-TOKEN': csrfToken
                     },
                     body: JSON.stringify({
                         entidade_id: Number(entId), // Sending securely as Number
                         entidade_type: 'App\\Models\\User'
                     })
                 });
                 if (apiRes.ok) {
                     const json = await apiRes.json() as any[];
                     if (Array.isArray(json)) {
                         json.forEach(item => {
                             // SGEdu API returns "telefone", not "numero"
                             const numberStr = item.telefone || item.numero;
                             if (numberStr) {
                                 let type = item.tipo || 'Celular';
                                 if (type === 'cel') type = 'Celular';
                                 const desc = item.obs || item.contato || 'Geral';
                                 addPhone(numberStr, desc);
                             }
                         });
                     }
                 }
             } catch (e) {
                 console.error('API fetch error:', e);
             }
        }

        // 3. Fallback: Parse stripped plain text for anything that looks like a phone number
        const hasTelefones = html.includes('Telefones');
        if (phones.length === 0 && hasTelefones) {
            // Constrain search to Telefones section
            const telefonesMatch = html.match(/Telefones[\s\S]*?(?:Endereço|Histórico|$)/i);
            const sectionText = telefonesMatch ? telefonesMatch[0] : html;
            
            const plainText = sectionText.replace(/<[^>]+>/g, ' '); // Strip HTML
            const phonePattern = /(\(?\d{2}\)?\s*\d{4,5}[-\s]\d{4})/g;
            let phoneMatch;
            
            while ((phoneMatch = phonePattern.exec(plainText)) !== null) {
                const number = phoneMatch[1].trim();
                
                if (!phones.find(p => p.number === number)) {
                    // Peek at next 60 characters for context
                    const contextStart = phoneMatch.index + phoneMatch[0].length;
                    let context = plainText.substring(contextStart, contextStart + 60);
                    // Stop at next phone number or big gap
                    context = context.split(/(\(?\d{2}\)?\s*\d{4,5}|[A-Z][a-z]+:)/)[0];
                    context = context.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim();
                    
                    let type = 'Telefone';
                    if (context.toLowerCase().includes('cel') || context.toLowerCase().includes('whatsapp')) type = 'Celular';
                    else if (context.toLowerCase().includes('fixo')) type = 'Fixo';
                    
                    // Simple heuristics for description
                    let description = 'Geral';
                    if (context.toLowerCase().includes('mãe') || context.toLowerCase().includes('mae')) description = 'Mãe';
                    else if (context.toLowerCase().includes('pai')) description = 'Pai';
                    else if (context.length > 2) {
                        description = context.substring(0, 30);
                        // Clean up hanging words
                        description = description.replace(/ (cel|fixo|contato) /gi, ' ').trim();
                    }

                    phones.push({ number, type, description });
                }
            }
        }

        // 4. Last Resort: Fetch Edit Page
        // The edit page usually contains the data in input fields (SSR).
        if (phones.length === 0) {
            console.log('Main page has no phones. Fetching Edit Page as fallback...');
            try {
                const editRes = await fetch(`${SGEduService.BASE_URL}/alunos/${studentId}/edit`, {
                    method: 'GET',
                    headers: this.getHeaders()
                });
                
                if (editRes.ok) {
                    const editHtml = await editRes.text();
                    console.log('Fetched Edit Page length:', editHtml.length);
                    
                    const editDoc = parser.parseFromString(editHtml, 'text/html');
                    const inputs = Array.from(editDoc.querySelectorAll('input'));
                    
                    // Filter inputs that might contain phone numbers
                    const phoneInputs = inputs.filter(input => {
                        const name = input.getAttribute('name') || '';
                        const id = input.getAttribute('id') || '';
                        return (name.includes('telefone') || name.includes('celular') || name.includes('fone') ||
                                id.includes('telefone') || id.includes('celular') || id.includes('fone'));
                    });
                    
                    console.log(`Found ${phoneInputs.length} potential phone inputs in Edit Page`);
                    
                    phoneInputs.forEach(input => {
                        const val = input.value || input.getAttribute('value') || '';
                        const cleanVal = val.replace(/\D/g, '');
                        
                        // Strict validation for BR phones: 10 or 11 digits.
                        if ((cleanVal.length === 10 || cleanVal.length === 11) && !/^0+$/.test(cleanVal)) {
                             const formattedNum = val.trim();
                             
                             let labelText = 'Geral';
                             const id = input.getAttribute('id');
                             if (id) {
                                  const label = editDoc.querySelector(`label[for="${id}"]`);
                                  if (label) labelText = label.textContent?.trim() || 'Geral';
                             }
                             console.log(`[PHONE TEST] Validated input phone: "${formattedNum}" with label "${labelText}"`);
                             addPhone(formattedNum, labelText);
                        } else if (cleanVal.length > 0) {
                             console.log(`[PHONE TEST] Invalid input phone length/format: "${cleanVal}"`);
                        }
                    });
                    
                    // Also run the aggressive regex on the edit page HTML as a final net
                    let editMatch;
                    let editRegexMatches = 0;
                    console.log('[PHONE TEST] 3. Scanning Edit HTML with regex...');
                    while ((editMatch = strictPhonePattern.exec(editHtml)) !== null) {
                        editRegexMatches++;
                        const num = editMatch[0];
                        const start = Math.max(0, editMatch.index - 40);
                        const end = Math.min(editHtml.length, editMatch.index + num.length + 40);
                        const context = editHtml.substring(start, end).replace(/<[^>]+>/g, ' ');
                        console.log(`[PHONE TEST] Regex Match #${editRegexMatches} on Edit HTML: "${num}"\n   Context: "${context}"`);
                        addPhone(num, context);
                    }
                    console.log(`[PHONE TEST] Finished Edit HTML scan. Found ${editRegexMatches} regex matches.`);

                } else {
                    console.log('Failed to fetch Edit Page:', editRes.status);
                }
            } catch (err) {
                console.error('Error fetching edit page:', err);
            }
        }

        
        
        // Helper to cleanup empty strings to undefined
        const clean = (val: string) => val ? val : undefined;

        console.log('--- END PHONE EXTRACTION TEST ---');
        console.log('Final extracted phones array:', phones);
        
        let responsiblePhone = phones[0]?.number || '';

        // Extract Photo URL
        let photoUrl = '';
        const imgCircle = doc.querySelector('.image-circle img');
        if (imgCircle) {
             const src = imgCircle.getAttribute('src');
             if (src) {
                 if (src.startsWith('http')) {
                     photoUrl = src;
                 } else {
                     photoUrl = `${SGEduService.BASE_URL}${src}`;
                 }
             }
        }
        console.log('Extracted Photo URL:', photoUrl);

        return { 
            birthDate: clean(birthDate), 
            cpf: clean(cpf), 
            photoUrl: clean(photoUrl),
            responsibleName: clean(responsibleName), 
            responsiblePhone: clean(responsiblePhone),
            responsibles, // Arrays should probably represent state, so empty array is valid "no responsibles found"
            phones,
            sus: clean(sus),
            nis: clean(nis),
            rg: clean(rg),
            naturalness: clean(naturalness),
            sex: clean(sex),
            colorRace: clean(colorRace),
            transport, // Booleans are fine
            bolsaFamilia
        };
    } catch (e) {
        console.error('Error fetching student details:', e);
        return null;
    }
  }

  async getStudentPhoto(photoUrl: string): Promise<string | null> {
      if (!photoUrl) return null;
      
      try {
           console.log('Fetching photo blob in background:', photoUrl);
           const imgRes = await fetch(photoUrl, {
               method: 'GET',
               headers: this.getHeaders()
           });
           
           if (imgRes.ok) {
               const blob = await imgRes.blob();
               const base64Url: string = await new Promise((resolve) => {
                   const reader = new FileReader();
                   reader.onloadend = () => resolve(reader.result as string);
                   reader.readAsDataURL(blob);
               });
               return base64Url;
           }
      } catch (err) {
           console.error('Failed to fetch student photo blob:', err);
      }
      return null;
  }

  async getStudentsFromClass(classIdOrUrl: string): Promise<{ professor: string, students: import('../types').Student[] }> {
    try {
      const url = classIdOrUrl.startsWith('http') 
          ? classIdOrUrl 
          : (classIdOrUrl.startsWith('/') ? `${SGEduService.BASE_URL}${classIdOrUrl}` : `${SGEduService.BASE_URL}/turmas/${classIdOrUrl}`);
          
      console.log('[SGEdu] getStudentsFromClass requested URL:', url);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      console.log('[SGEdu] Response status:', res.status, 'Final URL:', res.url);

      const html = await res.text();
      console.log('[SGEdu] HTML length received:', html.length);

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract Professor Name
      let professor = '';
      const h5s = doc.querySelectorAll('h5, h4, .professor-name, .info-box-text, p, div, span, td, .class-teacher-line');
      h5s.forEach(h5 => {
          if (h5.textContent?.includes('Professor')) {
             const parts = h5.textContent.split(':');
             if (parts.length > 1) {
                 professor = parts[1].trim();
             }
          }
      });

      const students: import('../types').Student[] = [];
      const addedIds = new Set<string>();

      // Search root for main content container
      const mainContent = doc.querySelector('.content-wrapper, .content, .main-content, #content, .class-show-page, body') || doc.body;

      // Helper to check if a row or container indicates a transferred/inactive student
      const isTransferredOrInactive = (el: Element): boolean => {
          const badgeEls = el.querySelectorAll('.class-student-badges, .badge, .label, .tag, .status, span');
          for (const b of Array.from(badgeEls)) {
              const text = b.textContent?.trim().toLowerCase() || '';
              if (
                  text.includes('transferid') || 
                  text.includes('cancelad') || 
                  text.includes('desistent') || 
                  text.includes('inativ') || 
                  text.includes('evadid') || 
                  text.includes('remanejad') ||
                  text.includes('desvinculad')
              ) {
                  return true;
              }
          }
          return false;
      };

      // Helper to add a student safely
      const addStudent = (id: string, rawName: string, stageName?: string) => {
          let name = rawName.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
          name = name.replace(/\s*\(PCD\)\s*/gi, '').trim();

          if (!name || name.length < 2 || /^(ações|acoes|opções|opcoes|nome|matrícula|matricula|#|\d+|alunos|professor)$/i.test(name)) {
              return;
          }

          if (id && !addedIds.has(id)) {
              addedIds.add(id);
              const cleanStage = (stageName && !/turma/i.test(stageName) && !/navega/i.test(stageName)) 
                  ? stageName.trim() 
                  : undefined;

              students.push({
                  id,
                  name,
                  ...(cleanStage ? { stage: cleanStage } : {})
              });
          }
      };

      // 1. Modern SGEdu Layout: DIV-based extraction (.class-student-row)
      const studentRows = mainContent.querySelectorAll('.class-student-row, [class*="student-row"]');
      console.log(`[SGEdu] Found ${studentRows.length} div.class-student-row elements`);

      if (studentRows.length > 0) {
          studentRows.forEach(row => {
              if (isTransferredOrInactive(row)) {
                  console.log(`[SGEdu] Skipping transferred/inactive student in row:`, row.querySelector('.class-student-name')?.textContent?.trim());
                  return;
              }

              const pane = row.closest('.tab-pane');
              let stageName = '';
              if (pane) {
                  const paneId = pane.getAttribute('id');
                  if (paneId) {
                      const tabLink = mainContent.querySelector(`a[href="#${paneId}"], a[data-target="#${paneId}"], a[aria-controls="${paneId}"]`);
                      if (tabLink) stageName = tabLink.textContent?.trim() || '';
                  }
                  if (!stageName) {
                      stageName = pane.querySelector('h3, h4, h5, .tab-title, .nav-link.active')?.textContent?.trim() || '';
                  }
              }

              const nameLink = row.querySelector('.class-student-name a, .class-student-main a, a');
              const nameText = row.querySelector('.class-student-name, .class-student-main')?.textContent || '';

              if (nameLink) {
                  const href = nameLink.getAttribute('href') || '';
                  const name = nameLink.textContent?.trim() || '';
                  const parts = href.split('?')[0].split('#')[0].split('/').filter(Boolean);
                  const lastPart = parts[parts.length - 1];
                  const id = (lastPart && /^\d+$/.test(lastPart)) 
                      ? lastPart 
                      : name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-');
                  
                  if (name) {
                      addStudent(id, name, stageName);
                  }
              } else if (nameText) {
                  const id = nameText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-');
                  addStudent(id, nameText, stageName);
              }
          });
      }

      // 2. Legacy SGEdu Layout: TABLE-based extraction
      if (students.length === 0) {
          const tableRows = mainContent.querySelectorAll('table tbody tr, table tr');
          console.log(`[SGEdu] Table fallback scanning ${tableRows.length} rows`);
          tableRows.forEach(row => {
              if (isTransferredOrInactive(row)) return;

              const pane = row.closest('.tab-pane');
              let stageName = '';
              if (pane) {
                  const paneId = pane.getAttribute('id');
                  if (paneId) {
                      const tabLink = mainContent.querySelector(`a[href="#${paneId}"], a[data-target="#${paneId}"], a[aria-controls="${paneId}"]`);
                      if (tabLink) stageName = tabLink.textContent?.trim() || '';
                  }
                  if (!stageName) {
                      stageName = pane.querySelector('h3, h4, h5, .tab-title, .nav-link.active')?.textContent?.trim() || '';
                  }
              }

              const nameLink = row.querySelector('td a, a');
              const cells = Array.from(row.querySelectorAll('td'));
              const name = nameLink?.textContent?.trim() || cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim() || '';
              const href = nameLink?.getAttribute('href') || '';
              const parts = href.split('?')[0].split('#')[0].split('/').filter(Boolean);
              const lastPart = parts[parts.length - 1];
              const id = (lastPart && /^\d+$/.test(lastPart)) 
                  ? lastPart 
                  : name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-');

              if (name) {
                  addStudent(id, name, stageName);
              }
          });
      }

      // 3. Universal Fallback: ANY Student Link Extraction (a[href*="/alunos/"])
      if (students.length === 0) {
          const allStudentLinks = mainContent.querySelectorAll('a[href*="/alunos/"]');
          console.log(`[SGEdu] Link fallback scanning ${allStudentLinks.length} a[href*="/alunos/"] elements`);
          allStudentLinks.forEach(link => {
              const href = link.getAttribute('href') || '';
              if (/\/turma/i.test(href) || /\/professores/i.test(href) || /\/escola/i.test(href)) return;

              const parentRow = link.closest('.class-student-row, tr, li, div') || link.parentElement;
              if (parentRow && isTransferredOrInactive(parentRow)) return;

              const parts = href.split('?')[0].split('#')[0].split('/').filter(Boolean);
              const lastPart = parts[parts.length - 1];
              if (lastPart && /^\d+$/.test(lastPart)) {
                  const name = link.textContent?.trim() || '';
                  const pane = link.closest('.tab-pane');
                  let stageName = '';
                  if (pane) {
                      stageName = pane.querySelector('h3, h4, h5, .tab-title, .nav-link.active')?.textContent?.trim() || '';
                  }
                  if (name) {
                      addStudent(lastPart, name, stageName);
                  }
              }
          });
      }

      // Sort students alphabetically by name
      students.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      console.log(`[SGEdu] Successfully extracted ${students.length} students from class URL (${url})`);
      return { professor, students };
    } catch (e) {
      console.error('[SGEdu] Error fetching class details:', e);
      return { professor: '', students: [] };
    }
  }

  async getProfessors(): Promise<{ id: string, name: string }[]> {
    try {
      console.log('Fetching professors list...');
      const res = await fetch(`${SGEduService.BASE_URL}/professores`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const rows = doc.querySelectorAll('table.table tbody tr');
      const professors: { id: string, name: string }[] = [];

      rows.forEach(row => {
        // Column 2 has the name inside an <a> tag
        const nameLink = row.querySelector('td:nth-child(2) a');
        if (nameLink) {
             const name = nameLink.textContent?.trim() || '';
             const href = nameLink.getAttribute('href') || '';
             // href=".../profissionais/60" -> id="60"
             const id = href.split('/').pop() || '';

             if (name) {
                 professors.push({ id, name });
             }
        }
      });
      
      console.log(`Found ${professors.length} professors`);
      return professors;

    } catch (e) {
      console.error('Error fetching professors:', e);
      return [];
    }
  }
}

